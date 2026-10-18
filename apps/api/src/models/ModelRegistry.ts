import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import { Database } from '../db.js';
import { Site } from './Site.js';
import { Supplier } from './Supplier.js';
import { Certificate } from './Certificate.js';
import { Lot } from './Lot.js';
import { WorkOrder } from './WorkOrder.js';
import { Serial } from './Serial.js';
import { Ncr } from './Ncr.js';
import { Workflow } from './Workflow.js';
import { AuditEvent } from './AuditEvent.js';
import { NcrCounter } from './NcrCounter.js';

/** Compiles models on the injected connection instead of the global Mongoose default. */
export class ModelRegistry {
  readonly Site: ReturnModelType<typeof Site>;
  readonly Supplier: ReturnModelType<typeof Supplier>;
  readonly Certificate: ReturnModelType<typeof Certificate>;
  readonly Lot: ReturnModelType<typeof Lot>;
  readonly WorkOrder: ReturnModelType<typeof WorkOrder>;
  readonly Serial: ReturnModelType<typeof Serial>;
  readonly Ncr: ReturnModelType<typeof Ncr>;
  readonly Workflow: ReturnModelType<typeof Workflow>;
  readonly AuditEvent: ReturnModelType<typeof AuditEvent>;
  readonly NcrCounter: ReturnModelType<typeof NcrCounter>;

  constructor(private readonly database: Database) {
    // Typegoose's process-wide cache must not reuse another container's models.
    const options = {
      existingConnection: database.connection,
      options: { disableCaching: true },
    };
    this.Site = getModelForClass(Site, options);
    this.Supplier = getModelForClass(Supplier, options);
    this.Certificate = getModelForClass(Certificate, options);
    this.Lot = getModelForClass(Lot, options);
    this.WorkOrder = getModelForClass(WorkOrder, options);
    this.Serial = getModelForClass(Serial, options);
    this.Ncr = getModelForClass(Ncr, options);
    this.Workflow = getModelForClass(Workflow, options);
    this.AuditEvent = getModelForClass(AuditEvent, options);
    this.NcrCounter = getModelForClass(NcrCounter, options);
  }

  async initialize(): Promise<void> {
    // Indexes and collection validation must exist before transactional commands.
    await Promise.all(
      [
        this.Site,
        this.Supplier,
        this.Certificate,
        this.Lot,
        this.WorkOrder,
        this.Serial,
        this.Ncr,
        this.Workflow,
        this.AuditEvent,
        this.NcrCounter,
      ].map((model) => model.init()),
    );
    await this.database.connection.db!.command({
      collMod: 'auditevents',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['seq', 'entityType', 'entityId', 'type', 'actorRole', 'payload', 'at'],
          properties: {
            seq: { bsonType: ['int', 'double', 'long'], minimum: 1 },
            entityType: { enum: ['NCR', 'LOT', 'WORK_ORDER', 'SERIAL'] },
            entityId: { bsonType: 'objectId' },
            actorRole: { enum: ['INSPECTOR', 'PRODUCTION', 'ENGINEERING', 'MRB', 'QUALITY'] },
            actorUsername: { bsonType: 'string', minLength: 1, maxLength: 80 },
            type: { bsonType: 'string' },
            payload: { bsonType: 'object' },
            at: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
}
