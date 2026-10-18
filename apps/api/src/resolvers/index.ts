import { GraphQLError } from 'graphql';
import type { Resolvers } from '../generated/resolvers-types.js';
import { ModelRegistry } from '../models/ModelRegistry.js';
import { NcrMapper } from '../models/NcrMapper.js';
import { WorkflowEngine } from '../workflow/engine.js';
import { stages } from '../workflow/types.js';
import { ApiConfig } from '../config.js';
import { ErpAdapter } from '../erp/ErpAdapter.js';
import { NcrCommands } from '../services/commands.js';
import { objectId, InputValidation } from '../validation/inputs.js';
import type { Context } from '../context.js';

export class ApiResolvers {
  constructor(
    private readonly models: ModelRegistry,
    private readonly config: ApiConfig,
    private readonly erp: ErpAdapter,
    private readonly commands: NcrCommands,
    private readonly engine: WorkflowEngine,
  ) {}
  private checkedId(id: string): string {
    return InputValidation.parse(objectId, id);
  }
  private async required<T>(promise: Promise<T | null>): Promise<T> {
    const value = await promise;
    if (!value)
      throw new GraphQLError('Broken data reference.', { extensions: { code: 'NOT_FOUND' } });
    return value;
  }
  private async mutate<T>(context: Context, command: () => Promise<T>): Promise<T> {
    const result = await this.commands.commandResult(command);
    // GraphQL executes top-level mutations serially; later fields must see new data.
    context.loaders.clear();
    return result;
  }

  readonly resolvers: Resolvers = {
    Query: {
      sites: () => this.models.Site.find().sort({ code: 1 }),
      workOrders: (_, { siteId }) =>
        this.models.WorkOrder.find(siteId ? { siteId: this.checkedId(siteId) } : {}).sort({
          number: 1,
        }),
      erpCatalog: () => this.erp.getCatalog(),
      ncr: (_, { id }) => this.models.Ncr.findById(this.checkedId(id)),
      ncrs: (_, { siteId, stage, severity }) =>
        this.models.Ncr.find({
          ...(siteId ? { siteId: this.checkedId(siteId) } : {}),
          ...(stage ? { stage } : {}),
          ...(severity ? { severity } : {}),
        }).sort({ number: 1 }),
      lotThread: (_, { lotNumber }) => this.models.Lot.findOne({ lotNumber: lotNumber.trim() }),
      operationsOverview: async (_, { siteId, severity }) => {
        const site = siteId ? this.checkedId(siteId) : undefined;
        const [ncrs, heldLots] = await Promise.all([
          this.models.Ncr.find({
            ...(site ? { siteId: site } : {}),
            ...(severity ? { severity } : {}),
          }).sort({ number: 1 }),
          this.models.Lot.find({ 'hold.active': true, ...(site ? { siteIds: site } : {}) }).sort({
            lotNumber: 1,
          }),
        ]);
        const cutoff = Date.now() - this.config.values.STALE_NCR_DAYS * 86_400_000;
        return {
          ncrs,
          heldLots,
          openNcrCount: ncrs.filter((ncr) => ncr.state === 'OPEN').length,
          stageCounts: stages
            .filter((stage) => stage !== 'CLOSED')
            .map((stage) => ({ stage, count: ncrs.filter((ncr) => ncr.stage === stage).length })),
          staleNcrs: ncrs.filter(
            (ncr) => ncr.state === 'OPEN' && ncr.stageEnteredAt.getTime() < cutoff,
          ),
          staleDays: this.config.values.STALE_NCR_DAYS,
        };
      },
    },
    Mutation: {
      createNcr: (_, { input }, context) =>
        this.mutate(context, () =>
          this.commands.createNcrCommand(input, context.role, context.username),
        ),
      transitionNcr: (_, { input }, context) =>
        this.mutate(context, () =>
          this.commands.transitionNcrCommand(input, context.role, context.username),
        ),
      containLot: (_, { input }, context) =>
        this.mutate(context, () =>
          this.commands.containLotCommand(input, context.role, context.username),
        ),
    },
    Site: { id: (site) => String(site._id) },
    Supplier: { id: (supplier) => String(supplier._id) },
    Certificate: {
      id: (cert) => String(cert._id),
      issuedAt: (cert) => cert.issuedAt.toISOString(),
    },
    Hold: { placedAt: (hold) => hold.placedAt.toISOString() },
    Consumption: { lotId: (consumption) => String(consumption.lotId) },
    WorkOrder: {
      id: (order) => String(order._id),
      site: (order, _, { loaders }) => this.required(loaders.siteById.load(String(order.siteId))),
      // Follow actual consumption references; matching a part number is not enough.
      // Reuse the request loader so all creation options share one batched lot read.
      lots: (order, _, { loaders }) =>
        Promise.all(
          [...new Set(order.consumedLots.map((item) => String(item.lotId)))].map((id) =>
            this.required(loaders.lotById.load(id)),
          ),
        ),
      serials: (order, _, { loaders }) => loaders.serialsByWorkOrderId.load(String(order._id)),
    },
    Serial: {
      id: (serial) => String(serial._id),
      site: (serial, _, { loaders }) => this.required(loaders.siteById.load(String(serial.siteId))),
    },
    Lot: {
      id: (lot) => String(lot._id),
      receivedAt: (lot) => lot.receivedAt.toISOString(),
      supplier: (lot, _, { loaders }) =>
        this.required(loaders.supplierById.load(String(lot.supplierId))),
      certificate: (lot, _, { loaders }) =>
        lot.certificateId ? loaders.certificateById.load(String(lot.certificateId)) : null,
      workOrders: (lot, _, { loaders }) => loaders.workOrdersByLotId.load(String(lot._id)),
      serials: (lot, _, { loaders }) => loaders.serialsByLotId.load(String(lot._id)),
      ncrs: (lot, _, { loaders }) => loaders.ncrsByLotId.load(String(lot._id)),
    },
    Ncr: {
      id: (ncr) => String(ncr._id),
      stageEnteredAt: (ncr) => ncr.stageEnteredAt.toISOString(),
      site: (ncr, _, { loaders }) => this.required(loaders.siteById.load(String(ncr.siteId))),
      workOrder: (ncr, _, { loaders }) =>
        this.required(loaders.workOrderById.load(String(ncr.workOrderId))),
      lot: (ncr, _, { loaders }) => (ncr.lotId ? loaders.lotById.load(String(ncr.lotId)) : null),
      serials: (ncr, _, { loaders }) =>
        Promise.all(ncr.serialIds.map((id) => this.required(loaders.serialById.load(String(id))))),
      events: (ncr, _, { loaders }) => loaders.eventsByNcrId.load(String(ncr._id)),
      availableActions: async (ncr, _, { loaders, role }) => {
        const workflow = await this.required(
          loaders.workflowByKey.load(`${ncr.workflowKey}:${ncr.workflowVersion}`),
        );
        const onHold = ncr.lotId
          ? Boolean((await loaders.lotById.load(String(ncr.lotId)))?.hold?.active)
          : ncr.serialIds.length > 0 &&
            (
              await Promise.all(ncr.serialIds.map((id) => loaders.serialById.load(String(id))))
            ).every((serial) => serial?.hold?.active);
        return this.commands.commandResult(async () =>
          this.engine.availableActions(NcrMapper.toState(ncr), workflow, role, onHold),
        );
      },
    },
    AuditEvent: {
      id: (event) => String(event._id),
      at: (event) => event.at.toISOString(),
      action: (event) => ('snapshot' in event.payload ? (event.payload.action ?? null) : null),
      fromStage: (event) => ('snapshot' in event.payload ? (event.payload.from ?? null) : null),
      toStage: (event) => ('snapshot' in event.payload ? event.payload.to : null),
    },
    ContainSiteCount: {
      site: (count, _, { loaders }) => this.required(loaders.siteById.load(count.siteId)),
    },
  };
}
