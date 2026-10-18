import DataLoader from 'dataloader';
import type { Types } from 'mongoose';
import { ModelRegistry } from './models/ModelRegistry.js';
import type {
  SiteDoc,
  SupplierDoc,
  CertificateDoc,
  LotDoc,
  WorkOrderDoc,
  SerialDoc,
} from './models/index.js';

export class RequestLoaders {
  constructor(private readonly models: ModelRegistry) {}
  private orderById<T extends { _id: Types.ObjectId }>(
    keys: readonly string[],
    rows: T[],
  ): (T | null)[] {
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    return keys.map((key) => byId.get(key) ?? null);
  }
  private group<T>(
    keys: readonly string[],
    rows: T[],
    keyFor: (row: T) => string | string[],
  ): T[][] {
    const buckets = new Map(keys.map((key) => [key, [] as T[]]));
    for (const row of rows) {
      const value = keyFor(row);
      for (const key of Array.isArray(value) ? value : [value]) buckets.get(key)?.push(row);
    }
    return keys.map((key) => buckets.get(key)!);
  }

  // A fresh set per HTTP request prevents role/data leakage between requests.

  readonly siteById = new DataLoader(async (ids: readonly string[]) =>
    this.orderById<SiteDoc>(ids, await this.models.Site.find({ _id: { $in: ids } })),
  );
  readonly supplierById = new DataLoader(async (ids: readonly string[]) =>
    this.orderById<SupplierDoc>(ids, await this.models.Supplier.find({ _id: { $in: ids } })),
  );
  readonly certificateById = new DataLoader(async (ids: readonly string[]) =>
    this.orderById<CertificateDoc>(ids, await this.models.Certificate.find({ _id: { $in: ids } })),
  );
  readonly lotById = new DataLoader(async (ids: readonly string[]) =>
    this.orderById<LotDoc>(ids, await this.models.Lot.find({ _id: { $in: ids } })),
  );
  readonly workOrderById = new DataLoader(async (ids: readonly string[]) =>
    this.orderById<WorkOrderDoc>(ids, await this.models.WorkOrder.find({ _id: { $in: ids } })),
  );
  readonly serialById = new DataLoader(async (ids: readonly string[]) =>
    this.orderById<SerialDoc>(ids, await this.models.Serial.find({ _id: { $in: ids } })),
  );
  readonly workOrdersByLotId = new DataLoader(async (ids: readonly string[]) =>
    this.group(
      ids,
      await this.models.WorkOrder.find({ 'consumedLots.lotId': { $in: ids } }),
      (row) => row.consumedLots.map((item) => String(item.lotId)),
    ),
  );
  readonly serialsByWorkOrderId = new DataLoader(async (ids: readonly string[]) =>
    this.group(ids, await this.models.Serial.find({ workOrderId: { $in: ids } }), (row) =>
      String(row.workOrderId),
    ),
  );
  readonly serialsByLotId = new DataLoader(async (ids: readonly string[]) =>
    this.group(ids, await this.models.Serial.find({ lotIds: { $in: ids } }), (row) =>
      row.lotIds.map(String),
    ),
  );
  readonly ncrsByLotId = new DataLoader(async (ids: readonly string[]) =>
    this.group(
      ids,
      await this.models.Ncr.find({ lotId: { $in: ids } }).sort({ number: 1 }),
      (row) => String(row.lotId),
    ),
  );
  readonly eventsByNcrId = new DataLoader(async (ids: readonly string[]) =>
    this.group(
      ids,
      await this.models.AuditEvent.find({ entityType: 'NCR', entityId: { $in: ids } }).sort({
        seq: 1,
      }),
      (row) => String(row.entityId),
    ),
  );
  readonly workflowByKey = new DataLoader(async (keys: readonly string[]) => {
    const pairs = keys.map((key) => {
      const [workflowKey, version] = key.split(':');
      return { key: workflowKey, version: Number(version) };
    });
    const rows = await this.models.Workflow.find({ $or: pairs }).lean();
    const byKey = new Map(rows.map((row) => [`${row.key}:${row.version}`, row]));
    return keys.map((key) => byKey.get(key) ?? null);
  });

  // GraphQL executes mutation fields serially; later fields must see committed data.
  clear(): void {
    this.siteById.clearAll();
    this.supplierById.clearAll();
    this.certificateById.clearAll();
    this.lotById.clearAll();
    this.workOrderById.clearAll();
    this.serialById.clearAll();
    this.workOrdersByLotId.clearAll();
    this.serialsByWorkOrderId.clearAll();
    this.serialsByLotId.clearAll();
    this.ncrsByLotId.clearAll();
    this.eventsByNcrId.clearAll();
    this.workflowByKey.clearAll();
  }
}
