import { Types } from 'mongoose';
import { NcrMapper } from '../src/models/NcrMapper.js';
import { ModelRegistry } from '../src/models/ModelRegistry.js';
import { Database } from '../src/db.js';
import { workflowV1 } from '../src/workflow/definition.js';
import { WorkflowEngine } from '../src/workflow/engine.js';
import type { NcrEvent, NcrState, Stage } from '../src/workflow/types.js';

export const suspectLot = 'LOT-EL-2291';
const anchor = '2026-10-01T08:00:00.000Z';
export class SeedService {
  constructor(
    private readonly database: Database,
    private readonly models: ModelRegistry,
    private readonly engine: WorkflowEngine,
  ) {}
  // Stable identifiers make the demo script, links, and integration tests repeatable.
  static fixtureId(group: number, item: number): Types.ObjectId {
    return new Types.ObjectId(
      `${group.toString(16).padStart(8, '0')}${item.toString(16).padStart(16, '0')}`,
    );
  }

  private seededNcr(
    index: number,
    target: Stage,
    siteId: string,
  ): { ncr: NcrState; events: NcrEvent[] } {
    const suspect = index <= 3;
    const workOrderIndex = index;
    let ncr: NcrState = {
      id: String(SeedService.fixtureId(7, index)),
      number: `NCR-2026-${String(index).padStart(3, '0')}`,
      siteId,
      workflowKey: 'ncr',
      workflowVersion: 1,
      stage: 'INITIATION',
      state: 'OPEN',
      severity: suspect ? 'MAJOR' : index === 4 ? 'CRITICAL' : 'MINOR',
      partNumber: 'SEAL-A320',
      revision: 'C',
      workOrderId: String(SeedService.fixtureId(5, workOrderIndex)),
      operationStep: 20,
      defectCode: suspect ? 'SEALING_DEFECT' : 'SURFACE_MARK',
      detectionSource: 'Final inspection',
      quantityAffected: suspect ? 4 : 1,
      lotId: String(SeedService.fixtureId(4, suspect ? 1 : index)),
      serialIds: [String(SeedService.fixtureId(6, (workOrderIndex - 1) * 2 + 1))],
      evidence: [`https://example.com/evidence/NCR-2026-${String(index).padStart(3, '0')}`],
      stageEnteredAt: anchor,
      lastEventSeq: 1,
    };
    const events = [this.engine.creationEvent(ncr, anchor)];
    for (const [stepIndex, action] of [
      'SUBMIT',
      'CONTAIN',
      'PROPOSE_DISPOSITION',
      'APPROVE',
      'COMPLETE_EXECUTION',
      'CLOSE',
    ].entries()) {
      if (ncr.stage === target) break;
      const route = workflowV1.transitions.find((transition) => transition.action === action)!;
      const result = this.engine.transitionNcr(ncr, workflowV1, {
        action: route.action,
        role: route.roles[0]!,
        expectedSeq: ncr.lastEventSeq,
        payload:
          action === 'CONTAIN'
            ? { containmentAction: 'Segregated in the inspection area.' }
            : action === 'PROPOSE_DISPOSITION'
              ? { disposition: 'SCRAP' }
              : action === 'CLOSE'
                ? { verificationNote: 'Scrap completion independently verified.' }
                : {},
        at: `2026-10-${String(2 + stepIndex).padStart(2, '0')}T09:00:00.000Z`,
        // The critical fixture is at INITIATION; it never bypasses a hold gate.
        materialOnHold: false,
      });
      ncr = result.ncr;
      events.push(result.event);
    }
    return { ncr, events };
  }

  async seed(): Promise<boolean> {
    // An existing workflow marks an initialized database. Re-running seed never
    // resets demo interactions; a partial seed cannot survive this transaction.
    return this.database.connection.transaction(async (session) => {
      if (await this.models.Workflow.exists({ key: 'ncr' }).session(session)) return false;
      if (await this.models.Ncr.exists({}).session(session))
        throw new Error('Refusing to seed a non-empty database without its workflow.');
      await this.models.Site.create(
        [
          { _id: SeedService.fixtureId(1, 1), code: 'LYO', name: 'Lyon', country: 'FR' },
          { _id: SeedService.fixtureId(1, 2), code: 'MTL', name: 'Montréal', country: 'CA' },
        ],
        { session, ordered: true },
      );
      await this.models.Supplier.create(
        ['Elastomer Supply', 'Precision Metals', 'AeroChem Materials'].map((name, index) => ({
          _id: SeedService.fixtureId(2, index + 1),
          code: ['ELS', 'PRM', 'ACM'][index],
          name,
          status: 'APPROVED',
        })),
        { session, ordered: true },
      );
      const lots = Array.from({ length: 8 }, (_, index) => ({
        _id: SeedService.fixtureId(4, index + 1),
        lotNumber: index === 0 ? suspectLot : `LOT-EL-${2300 + index}`,
        partNumber: 'SEAL-A320',
        supplierId: SeedService.fixtureId(2, (index % 3) + 1),
        certificateId: SeedService.fixtureId(3, index + 1),
        receivedAt: new Date('2026-09-28T08:00:00.000Z'),
        siteIds:
          index === 0
            ? [SeedService.fixtureId(1, 1), SeedService.fixtureId(1, 2)]
            : [SeedService.fixtureId(1, (index % 2) + 1)],
      }));
      await this.models.Certificate.create(
        lots.map((lot, index) => ({
          _id: SeedService.fixtureId(3, index + 1),
          number: `COC-2026-${400 + index}`,
          supplierId: lot.supplierId,
          type: 'Material CoC',
          issuedAt: new Date('2026-09-25T08:00:00.000Z'),
          url: `https://example.com/certificates/COC-2026-${400 + index}`,
        })),
        { session, ordered: true },
      );
      const workOrders = Array.from({ length: 15 }, (_, offset) => {
        const index = offset + 1;
        const site = index === 1 || index === 2 ? 1 : index === 3 ? 2 : index % 2 === 0 ? 2 : 1;
        const lotIndex = index <= 3 ? 1 : ((index - 1) % 7) + 2;
        // NCR 4..8 use the matching lot number; other orders fill the dashboard.
        const actualLot = index <= 8 && index > 3 ? index : lotIndex;
        return {
          _id: SeedService.fixtureId(5, index),
          number: `WO-${site === 1 ? 'LYO' : 'MTL'}-${1040 + index}`,
          siteId: SeedService.fixtureId(1, site),
          orderRef: 'PO-2026-410',
          partNumber: 'SEAL-A320',
          revision: 'C',
          operations: [
            { step: 10, name: 'Moulding', status: 'COMPLETE' },
            { step: 20, name: 'Final inspection', status: 'IN_PROGRESS' },
          ],
          consumedLots: [{ lotId: SeedService.fixtureId(4, actualLot), qty: 12 }],
        };
      });
      // Derive membership from actual consumption links so site filtering stays
      // consistent even for the non-suspect background lots.
      for (const lot of lots) {
        const siteIds = workOrders
          .filter((order) => order.consumedLots.some((item) => item.lotId.equals(lot._id)))
          .map((order) => String(order.siteId));
        lot.siteIds = [...new Set(siteIds)].map((id) => new Types.ObjectId(id));
      }
      // Mongoose must serialize multi-document inserts within a transaction.
      await this.models.Lot.create(lots, { session, ordered: true });
      await this.models.WorkOrder.create(workOrders, { session, ordered: true });
      await this.models.Serial.create(
        workOrders.flatMap((order, offset) =>
          Array.from({ length: offset < 10 ? 2 : 0 }, (_, serialOffset) => ({
            _id: SeedService.fixtureId(6, offset * 2 + serialOffset + 1),
            serialNumber: `AS-${String(offset * 2 + serialOffset + 1).padStart(5, '0')}`,
            workOrderId: order._id,
            siteId: order.siteId,
            partNumber: order.partNumber,
            lotIds: order.consumedLots.map((item) => item.lotId),
          })),
        ),
        { session, ordered: true },
      );
      await this.models.Workflow.create([workflowV1], { session, ordered: true });
      const targets: Stage[] = [
        'CONTAINMENT',
        'CONTAINMENT',
        'CONTAINMENT',
        'INITIATION',
        'MRB_REVIEW',
        'DISPOSITION',
        'EXECUTION',
        'CLOSURE',
      ];
      for (const [offset, target] of targets.entries()) {
        // Use the work order's canonical site before creating any historical event.
        const { ncr, events } = this.seededNcr(
          offset + 1,
          target,
          String(workOrders[offset]!.siteId),
        );
        await this.models.AuditEvent.create(
          events.map((event) => ({
            ...event,
            actorUsername: 'demo-seed',
            entityId: new Types.ObjectId(event.entityId),
            siteId: new Types.ObjectId(event.siteId),
            at: new Date(event.at),
          })),
          { session, ordered: true },
        );
        await this.models.Ncr.create([NcrMapper.toProjection(ncr)], { session, ordered: true });
      }
      return true;
    });
  }
}
