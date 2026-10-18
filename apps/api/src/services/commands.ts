import mongoose, { Types, type ClientSession } from 'mongoose';
import { GraphQLError } from 'graphql';
import { NcrMapper, type NcrDoc, type Hold } from '../models/index.js';
import { ModelRegistry } from '../models/ModelRegistry.js';
import { Database } from '../db.js';
import { ErpAdapter } from '../erp/ErpAdapter.js';
import { WorkflowEngine, WorkflowError } from '../workflow/engine.js';
import type { NcrEvent, NcrState, Role } from '../workflow/types.js';
import type {
  CreateNcrInput,
  TransitionNcrInput,
  ContainLotInput,
} from '../generated/resolvers-types.js';
import type { ContainSiteCountRow } from '../context.js';
import {
  containLotSchema,
  createNcrSchema,
  InputValidation,
  transitionSchema,
} from '../validation/inputs.js';

export interface ContainLotResult {
  lotsPlacedOnHold: number;
  bySite: ContainSiteCountRow[];
}

export class NcrCommands {
  constructor(
    private readonly database: Database,
    private readonly models: ModelRegistry,
    private readonly erp: ErpAdapter,
    private readonly engine: WorkflowEngine,
  ) {}
  private notFound(label: string): GraphQLError {
    return new GraphQLError(`${label} not found.`, { extensions: { code: 'NOT_FOUND' } });
  }
  private badReference(message: string): GraphQLError {
    return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  private requireRole(role: Role, permitted: Role[]): void {
    if (!permitted.includes(role))
      throw new WorkflowError('FORBIDDEN_ROLE', 'Your selected role cannot perform this action.');
  }

  private async appendNcrEvent(
    event: NcrEvent,
    session: ClientSession,
    actorUsername: string,
  ): Promise<void> {
    await this.models.AuditEvent.create(
      [
        {
          ...event,
          actorUsername,
          entityId: new Types.ObjectId(event.entityId),
          siteId: new Types.ObjectId(event.siteId),
          at: new Date(event.at),
        },
      ],
      { session },
    );
  }

  async createNcrCommand(raw: CreateNcrInput, role: Role, username: string): Promise<NcrDoc> {
    this.requireRole(role, ['INSPECTOR']);
    const input = InputValidation.parse(createNcrSchema, raw);
    const year = new Date().getUTCFullYear();
    const prefix = `NCR-${year}-`;
    const latest = await this.models.Ncr.findOne({ number: new RegExp(`^${prefix}\\d+$`) })
      .sort({ number: -1 })
      .collation({ locale: 'en', numericOrdering: true })
      .select('number')
      .lean();
    // Reserve outside the NCR transaction: retries/concurrent requests cannot reuse
    // a number. Failed commands may leave gaps, but never duplicate an existing NCR.
    // The maximum also bootstraps an existing database containing seeded records.
    const counter = await this.models.NcrCounter.findOneAndUpdate(
      { _id: String(year) },
      [
        {
          $set: {
            value: {
              $add: [
                {
                  $max: [
                    { $ifNull: ['$value', 0] },
                    latest ? Number(latest.number.slice(prefix.length)) : 0,
                  ],
                },
                1,
              ],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after', updatePipeline: true },
    );
    if (!counter) throw new Error('Unable to reserve an NCR number.');
    return this.database.connection.transaction(async (session) => {
      const workOrder = await this.models.WorkOrder.findById(input.workOrderId).session(session);
      if (!workOrder) throw this.notFound('Work order');
      if (!workOrder.operations.some((operation) => operation.step === input.operationStep))
        throw this.badReference('Operation does not belong to this work order.');
      if (!this.erp.findPart(workOrder.partNumber, workOrder.revision))
        throw this.badReference('Part revision is absent from the ERP catalog.');
      if (input.lotId && !workOrder.consumedLots.some((item) => String(item.lotId) === input.lotId))
        throw this.badReference('Select a material lot used by this work order.');
      const serialIds = [...new Set(input.serialIds)];
      const availableQuantity = input.lotId
        ? workOrder.consumedLots
            .filter((item) => String(item.lotId) === input.lotId)
            .reduce((quantity, item) => quantity + item.qty, 0)
        : serialIds.length;
      if (input.quantityAffected > Math.floor(availableQuantity))
        throw this.badReference(
          `Quantity affected cannot exceed ${Math.floor(availableQuantity)} for the selected material.`,
        );
      if (
        serialIds.length &&
        (await this.models.Serial.countDocuments({
          _id: { $in: serialIds },
          workOrderId: workOrder._id,
          ...(input.lotId ? { lotIds: input.lotId } : {}),
        }).session(session)) !== serialIds.length
      ) {
        throw this.badReference('Serials must belong to the work order and selected lot.');
      }
      const workflow = await this.models.Workflow.findOne({ key: 'ncr' })
        .sort({ version: -1 })
        .session(session);
      if (!workflow) throw this.notFound('Published workflow');
      const id = new Types.ObjectId();
      const at = new Date().toISOString();
      const state: NcrState = {
        ...input,
        id: String(id),
        number: `${prefix}${String(counter.value).padStart(3, '0')}`,
        siteId: String(workOrder.siteId),
        serialIds,
        partNumber: workOrder.partNumber,
        revision: workOrder.revision,
        workflowKey: workflow.key,
        workflowVersion: workflow.version,
        stage: 'INITIATION',
        state: 'OPEN',
        stageEnteredAt: at,
        lastEventSeq: 1,
      };
      await this.appendNcrEvent(this.engine.creationEvent(state, at), session, username);
      const [ncr] = await this.models.Ncr.create([NcrMapper.toProjection(state)], { session });
      return ncr!;
    });
  }

  async transitionNcrCommand(
    raw: TransitionNcrInput,
    role: Role,
    username: string,
  ): Promise<NcrDoc> {
    const input = InputValidation.parse(transitionSchema, raw);
    return this.database.connection.transaction(async (session) => {
      const current = await this.models.Ncr.findById(input.ncrId).session(session);
      if (!current) throw this.notFound('NCR');
      const workflow = await this.models.Workflow.findOne({
        key: current.workflowKey,
        version: current.workflowVersion,
      })
        .session(session)
        .lean();
      if (!workflow) throw this.notFound('Pinned workflow');
      let materialOnHold = false;
      if (current.lotId) {
        materialOnHold = Boolean(
          await this.models.Lot.exists({ _id: current.lotId, 'hold.active': true }).session(
            session,
          ),
        );
      } else if (current.serialIds.length) {
        const heldSerials = await this.models.Serial.countDocuments({
          _id: { $in: current.serialIds },
          'hold.active': true,
        }).session(session);
        materialOnHold = heldSerials === current.serialIds.length;
      }
      const { ncr, event } = this.engine.transitionNcr(NcrMapper.toState(current), workflow, {
        action: input.action,
        expectedSeq: input.expectedSeq,
        payload: input.payload,
        role,
        at: new Date().toISOString(),
        materialOnHold,
      });
      await this.appendNcrEvent(event, session, username);
      const { _id: id, ...projection } = NcrMapper.toProjection(ncr);
      const values = { ...projection };
      const optionalFields = [
        'disposition',
        'engineeringInstructions',
        'mrbApproval',
        'containmentAction',
        'verificationNote',
      ] as const;
      const removed: Partial<Record<(typeof optionalFields)[number], ''>> = {};
      for (const field of optionalFields) {
        if (ncr[field] === undefined) {
          delete values[field];
          removed[field] = '';
        }
      }
      // This predicate protects the projection even when two clients read the same seq.
      // Explicit $unset is essential: Mongoose omits undefined values from $set,
      // which would otherwise leave a rejected disposition/approval in the database.
      const updated = await this.models.Ncr.findOneAndUpdate(
        { _id: id, lastEventSeq: input.expectedSeq },
        { $set: values, $unset: removed },
        { session, returnDocument: 'after', runValidators: true },
      );
      if (!updated)
        throw new WorkflowError('CONFLICT', 'This NCR changed. Reload before retrying.');
      return updated;
    });
  }

  async containLotCommand(
    raw: ContainLotInput,
    role: Role,
    username: string,
  ): Promise<ContainLotResult> {
    this.requireRole(role, ['PRODUCTION', 'QUALITY']);
    const input = InputValidation.parse(containLotSchema, raw);
    return this.database.connection.transaction(async (session) => {
      const lot = await this.models.Lot.findOne({ lotNumber: input.lotNumber }).session(session);
      if (!lot) throw this.notFound('Lot');
      if (
        input.sourceNcrId &&
        !(await this.models.Ncr.exists({ _id: input.sourceNcrId, lotId: lot._id }).session(session))
      )
        throw this.badReference('Source NCR must reference this lot.');
      const at = new Date();
      const hold: Hold = {
        active: true,
        reason: input.reason,
        sourceNcrId: input.sourceNcrId ? new Types.ObjectId(input.sourceNcrId) : undefined,
        placedAt: at,
        placedByRole: role,
      };
      const counts = new Map<string, ContainSiteCountRow>();
      const workOrders = await this.models.WorkOrder.find({
        'consumedLots.lotId': lot._id,
      }).session(session);
      // Include all serials of consuming orders, even if a serial's lotIds is incomplete.
      const serials = await this.models.Serial.find({
        $or: [{ workOrderId: { $in: workOrders.map((order) => order._id) } }, { lotIds: lot._id }],
      }).session(session);
      let lotsPlacedOnHold = 0;
      for (const entity of [lot, ...workOrders, ...serials]) {
        if (entity.hold?.active) continue;
        entity.set('hold', hold);
        entity.lastEventSeq += 1;
        await entity.save({ session });
        const entityType =
          entity instanceof this.models.Lot
            ? 'LOT'
            : entity instanceof this.models.WorkOrder
              ? 'WORK_ORDER'
              : 'SERIAL';
        const siteId = 'siteId' in entity ? entity.siteId : undefined;
        await this.models.AuditEvent.create(
          [
            {
              seq: entity.lastEventSeq,
              entityType,
              entityId: entity._id,
              siteId,
              type: 'HOLD_PLACED',
              actorRole: role,
              actorUsername: username,
              reason: input.reason,
              at,
              payload: { lotNumber: lot.lotNumber, hold },
            },
          ],
          { session },
        );
        if (entityType === 'LOT') lotsPlacedOnHold += 1;
        else if (siteId) {
          const key = String(siteId);
          const count = counts.get(key) ?? { siteId: key, workOrders: 0, serials: 0 };
          counts.set(key, count);
          if (entityType === 'WORK_ORDER') count.workOrders += 1;
          else count.serials += 1;
        }
      }
      return { lotsPlacedOnHold, bySite: [...counts.values()] };
    });
  }

  async commandResult<T>(command: () => Promise<T>): Promise<T> {
    try {
      return await command();
    } catch (error) {
      if (error instanceof WorkflowError)
        throw new GraphQLError(error.message, {
          extensions: { code: error.code, blockedBy: error.blockedBy },
        });
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000)
        throw new GraphQLError('A concurrent command already changed this entity.', {
          extensions: { code: 'CONFLICT' },
        });
      throw error;
    }
  }
}
