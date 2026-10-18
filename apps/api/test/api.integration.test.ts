import { testCredentials } from './credentials.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { z } from 'zod';
import { ApiContainer } from '../src/container.js';
import { ApiApplication } from '../src/app.js';
import { Database } from '../src/db.js';
import { ErpAdapter } from '../src/erp/ErpAdapter.js';
import { ModelRegistry } from '../src/models/ModelRegistry.js';
import { NcrMapper } from '../src/models/NcrMapper.js';
import { SeedService } from '../seed/data.js';
import { workflowV1 } from '../src/workflow/definition.js';
import { AuditReplay } from '../src/workflow/replay.js';
import type { NcrEvent } from '../src/workflow/types.js';

const container = new ApiContainer();
const application = container.get(ApiApplication);
const app = application.create({ logging: false });
let cookie = '';
const database = container.get(Database);
const seed = container.get(SeedService);
const audit = container.get(AuditReplay);
const {
  AuditEvent: AuditEventModel,
  Lot: LotModel,
  Ncr: NcrModel,
  Serial: SerialModel,
  WorkOrder: WorkOrderModel,
} = container.get(ModelRegistry);
let replicaSet: MongoMemoryReplSet;
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const ncrResultSchema = z.object({
  id: z.string(),
  number: z.string().optional(),
  stage: z.string(),
  lastEventSeq: z.number(),
});
const responseSchema = z.object({
  data: z
    .object({
      createNcr: ncrResultSchema.optional(),
      workOrders: z
        .array(
          z.object({
            id: z.string(),
            number: z.string(),
            lots: z.array(z.object({ id: z.string(), lotNumber: z.string() })),
          }),
        )
        .optional(),
      transitionNcr: ncrResultSchema.optional(),
      containLot: z
        .object({
          lotsPlacedOnHold: z.number(),
          bySite: z.array(
            z.object({
              site: z.object({ code: z.string() }),
              workOrders: z.number(),
              serials: z.number(),
            }),
          ),
        })
        .optional(),
      lotThread: z
        .object({ ncrs: z.array(z.object({ site: z.object({ code: z.string() }) })) })
        .optional(),
    })
    .nullish(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        extensions: z.object({
          code: z.string(),
          blockedBy: z.array(z.string()).optional(),
          issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
        }),
      }),
    )
    .optional(),
});
async function gql(
  query: string,
  variables: Record<string, JsonValue> = {},
  role: string = 'INSPECTOR',
): Promise<z.infer<typeof responseSchema>> {
  const response = await app.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-role': role, cookie },
    body: JSON.stringify({ query, variables }),
  });
  return responseSchema.parse(await response.json());
}
const transition = `mutation Transition($input: TransitionNcrInput!) { transitionNcr(input: $input) { id stage lastEventSeq } }`;
const contain = `mutation Contain($input: ContainLotInput!) { containLot(input: $input) { lotsPlacedOnHold bySite { site { code } workOrders serials } } }`;

beforeAll(async () => {
  // A real single-node replica set exercises MongoDB transactions and indexes.
  replicaSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await application.initialize(replicaSet.getUri('ncrflow'), false);
  const login = await app.fetch('http://localhost/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testCredentials.username,
      password: testCredentials.password,
    }),
  });
  cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(cookie).toMatch(/^ncr_demo_session=/);
});
beforeEach(async () => {
  // Fixture cleanup is test-only; application code never updates/deletes audit events.
  const collections = await database.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
  await seed.seed();
});
afterAll(async () => {
  await database.disconnect();
  await replicaSet?.stop();
});

describe('GraphQL commands against MongoDB', () => {
  it('injects an alternate ERP adapter into transactional commands without writing on rejection', async () => {
    const alternate = new ApiContainer();
    const erp = new ErpAdapter();
    // This application sees no compatible ERP revision, even though the shared
    // seeded database contains a valid order. No hard-coded adapter may bypass it.
    erp.findPart = () => undefined;
    alternate.rebind(ErpAdapter).toConstantValue(erp);
    try {
      await alternate.get(ApiApplication).initialize(replicaSet.getUri('ncrflow'), false);
      const alternateApp = alternate.get(ApiApplication).create({ logging: false });
      const login = await alternateApp.fetch('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testCredentials.username,
          password: testCredentials.password,
        }),
      });
      const alternateCookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
      const response = await alternateApp.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'INSPECTOR',
          cookie: alternateCookie,
        },
        body: JSON.stringify({
          query:
            'mutation Create($input: CreateNcrInput!) { createNcr(input: $input) { id stage lastEventSeq } }',
          variables: {
            input: {
              workOrderId: String(SeedService.fixtureId(5, 1)),
              lotId: String(SeedService.fixtureId(4, 1)),
              operationStep: 20,
              severity: 'MAJOR',
              defectCode: 'SEALING_DEFECT',
              detectionSource: 'Inspection',
              quantityAffected: 1,
              evidence: ['https://example.com/proof'],
            },
          },
        }),
      });
      const result = responseSchema.parse(await response.json());
      expect(result.errors?.[0]).toMatchObject({
        message: 'Part revision is absent from the ERP catalog.',
        extensions: { code: 'BAD_USER_INPUT' },
      });
      expect(await NcrModel.countDocuments()).toBe(8);
      expect(await AuditEventModel.countDocuments({ type: 'NCR_CREATED' })).toBe(8);
      // Disconnecting the alternate application must not affect the original.
    } finally {
      await alternate.get(Database).disconnect();
    }
    expect(database.available).toBe(true);
    expect(await NcrModel.countDocuments()).toBe(8);
  });

  it('seeds deterministic, idempotent data and replayable histories', async () => {
    expect(await seed.seed()).toBe(false);
    expect(await NcrModel.countDocuments()).toBe(8);
    expect(await WorkOrderModel.countDocuments()).toBe(15);
    expect(await SerialModel.countDocuments()).toBe(20);
    const ncrs = await NcrModel.find();
    for (const ncr of ncrs) {
      const rows = await AuditEventModel.find({ entityType: 'NCR', entityId: ncr._id }).sort({
        seq: 1,
      });
      const events = rows.map((row): NcrEvent => {
        if (
          !('snapshot' in row.payload) ||
          row.type === 'HOLD_PLACED' ||
          !row.workflowVersion ||
          !row.siteId
        ) {
          throw new Error('Expected a complete NCR audit event.');
        }
        return {
          entityType: 'NCR',
          type: row.type,
          seq: row.seq,
          actorRole: row.actorRole,
          reason: row.reason,
          workflowVersion: row.workflowVersion,
          entityId: String(row.entityId),
          siteId: String(row.siteId),
          at: row.at.toISOString(),
          payload: row.payload,
        };
      });
      // MongoDB drops undefined optional properties; normalize them on both sides.
      expect(JSON.parse(JSON.stringify(audit.replay(events, workflowV1)))).toEqual(
        JSON.parse(JSON.stringify(NcrMapper.toState(ncr))),
      );
    }
  });
  it('shows two Lyon and one Montréal NCR for the suspect lot', async () => {
    const result = await gql(`{ lotThread(lotNumber: "LOT-EL-2291") { ncrs { site { code } } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data?.lotThread?.ncrs.map((ncr) => ncr.site.code).sort()).toEqual([
      'LYO',
      'LYO',
      'MTL',
    ]);
  });
  it('commits a transition and its event atomically, and rejects stale commands', async () => {
    const id = String(SeedService.fixtureId(7, 1));
    const input = {
      ncrId: id,
      action: 'CONTAIN',
      expectedSeq: 2,
      payload: { containmentAction: 'Segregated at both sites.' },
    };
    const result = await gql(transition, { input }, 'PRODUCTION');
    expect(result.errors).toBeUndefined();
    expect(result.data?.transitionNcr).toMatchObject({ stage: 'MRB_REVIEW', lastEventSeq: 3 });
    expect(await AuditEventModel.findOne({ entityId: id, seq: 3 }).lean()).toMatchObject({
      actorUsername: testCredentials.username,
      actorRole: 'PRODUCTION',
      workflowVersion: 1,
    });
    const count = await AuditEventModel.countDocuments({ entityType: 'NCR', entityId: id });
    const conflict = await gql(transition, { input }, 'PRODUCTION');
    expect(conflict.errors?.[0]?.extensions.code).toBe('CONFLICT');
    expect(await AuditEventModel.countDocuments({ entityType: 'NCR', entityId: id })).toBe(count);
    expect((await NcrModel.findById(id))?.stage).toBe('MRB_REVIEW');
  });
  it('rolls back the appended event if writing the projection fails', async () => {
    const db = database.connection.db!;
    // Force a database-side projection failure after event insertion; the event
    // must be rolled back by the same transaction rather than surviving alone.
    await db.command({
      collMod: 'ncrs',
      validator: { stage: { $ne: 'MRB_REVIEW' } },
      validationLevel: 'strict',
    });
    try {
      const id = String(SeedService.fixtureId(7, 1));
      const result = await gql(
        transition,
        {
          input: {
            ncrId: id,
            action: 'CONTAIN',
            expectedSeq: 2,
            payload: { containmentAction: 'Segregated.' },
          },
        },
        'PRODUCTION',
      );
      expect(result.errors).toBeDefined();
      expect(await AuditEventModel.countDocuments({ entityType: 'NCR', entityId: id })).toBe(2);
      expect((await NcrModel.findById(id))?.lastEventSeq).toBe(2);
    } finally {
      await db.command({ collMod: 'ncrs', validator: {} });
    }
  });
  it('allows only one competing command with the same expected sequence', async () => {
    const input = {
      ncrId: String(SeedService.fixtureId(7, 1)),
      action: 'CONTAIN',
      expectedSeq: 2,
      payload: { containmentAction: 'Segregated.' },
    };
    const results = await Promise.all([
      gql(transition, { input }, 'PRODUCTION'),
      gql(transition, { input }, 'PRODUCTION'),
    ]);
    expect(results.filter((result) => !result.errors)).toHaveLength(1);
    expect(results.find((result) => result.errors)?.errors?.[0]?.extensions.code).toBe('CONFLICT');
    expect(await AuditEventModel.countDocuments({ entityType: 'NCR', entityId: input.ncrId })).toBe(
      3,
    );
  });
  it('blocks critical containment until its actual material is on hold', async () => {
    const id = String(SeedService.fixtureId(7, 4));
    const submitted = await gql(transition, {
      input: { ncrId: id, action: 'SUBMIT', expectedSeq: 1, payload: {} },
    });
    expect(submitted.errors).toBeUndefined();
    const input = {
      ncrId: id,
      action: 'CONTAIN',
      expectedSeq: 2,
      payload: { containmentAction: 'Segregated at the inspection station.' },
    };
    const blocked = await gql(transition, { input }, 'PRODUCTION');
    expect(blocked.errors?.[0]?.extensions.code).toBe('GATE_FAILED');
    expect(await AuditEventModel.countDocuments({ entityType: 'NCR', entityId: id })).toBe(2);
    expect(
      (
        await gql(
          contain,
          { input: { lotNumber: 'LOT-EL-2303', reason: 'Critical defect investigation.' } },
          'QUALITY',
        )
      ).errors,
    ).toBeUndefined();
    expect((await gql(transition, { input }, 'PRODUCTION')).data?.transitionNcr?.stage).toBe(
      'MRB_REVIEW',
    );
  });
  it('persists removal of the proposed disposition after MRB rejection', async () => {
    const id = String(SeedService.fixtureId(7, 6));
    const ncr = await NcrModel.findById(id);
    const result = await gql(
      transition,
      {
        input: {
          ncrId: id,
          action: 'REJECT',
          expectedSeq: ncr!.lastEventSeq,
          payload: { reason: 'Further investigation required.' },
        },
      },
      'MRB',
    );
    expect(result.errors).toBeUndefined();
    const updated = await NcrModel.findById(id);
    expect(updated?.stage).toBe('MRB_REVIEW');
    expect(updated?.disposition).toBeUndefined();
    expect(updated?.mrbApproval).toBeUndefined();
  });
  it('propagates holds to both sites and skips already held entities', async () => {
    const input = {
      lotNumber: 'LOT-EL-2291',
      reason: 'Supplier batch investigation.',
      sourceNcrId: String(SeedService.fixtureId(7, 1)),
    };
    const result = await gql(contain, { input }, 'PRODUCTION');
    expect(result.errors).toBeUndefined();
    expect(result.data?.containLot).toEqual({
      lotsPlacedOnHold: 1,
      bySite: expect.arrayContaining([
        { site: { code: 'LYO' }, workOrders: 2, serials: 4 },
        { site: { code: 'MTL' }, workOrders: 1, serials: 2 },
      ]),
    });
    const events = await AuditEventModel.countDocuments({ type: 'HOLD_PLACED' });
    expect(events).toBe(10);
    expect(
      await AuditEventModel.countDocuments({
        type: 'HOLD_PLACED',
        actorUsername: testCredentials.username,
        actorRole: 'PRODUCTION',
      }),
    ).toBe(10);
    expect(await LotModel.countDocuments({ 'hold.active': true })).toBe(1);
    const second = await gql(contain, { input }, 'QUALITY');
    expect(second.data?.containLot).toEqual({ lotsPlacedOnHold: 0, bySite: [] });
    expect(await AuditEventModel.countDocuments({ type: 'HOLD_PLACED' })).toBe(events);
  });
  it('rejects unauthorized roles and invalid inputs without writing events', async () => {
    const count = await AuditEventModel.countDocuments();
    expect(
      (
        await gql(
          contain,
          { input: { lotNumber: 'LOT-EL-2291', reason: 'Investigation.' } },
          'INSPECTOR',
        )
      ).errors?.[0]?.extensions.code,
    ).toBe('FORBIDDEN_ROLE');
    const invalid = await gql(
      contain,
      { input: { lotNumber: 'LOT-EL-2291', reason: ' ' } },
      'PRODUCTION',
    );
    expect(invalid.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      issues: [expect.objectContaining({ path: 'reason' })],
    });
    const invalidEvidence = await gql(transition, {
      input: {
        ncrId: String(SeedService.fixtureId(7, 1)),
        expectedSeq: 1,
        action: 'SUBMIT',
        payload: { evidence: ['not-a-url'] },
      },
    });
    // Invalid URL syntax and protocol must produce a single field issue, with no writes.
    expect(invalidEvidence.errors?.[0]?.extensions).toEqual({
      code: 'BAD_USER_INPUT',
      issues: [
        {
          path: 'payload.evidence.0',
          message: 'Enter a valid URL starting with http:// or https://.',
        },
      ],
    });
    expect((await gql('{ sites { code } }', {}, 'ADMIN')).errors?.[0]?.extensions.code).toBe(
      'BAD_USER_INPUT',
    );
    expect(await AuditEventModel.countDocuments()).toBe(count);
  });
  it('creates an Inspector NCR with a coherent audit root and validates references', async () => {
    const query = `mutation Create($input: CreateNcrInput!) { createNcr(input: $input) { id number stage lastEventSeq } }`;
    const input = {
      workOrderId: String(SeedService.fixtureId(5, 1)),
      operationStep: 20,
      lotId: String(SeedService.fixtureId(4, 1)),
      severity: 'MAJOR',
      defectCode: 'SEALING_DEFECT',
      detectionSource: 'Final inspection',
      quantityAffected: 1,
      evidence: ['https://example.com/evidence'],
    };
    const result = await gql(query, { input });
    expect(result.errors).toBeUndefined();
    expect(result.data?.createNcr).toMatchObject({ stage: 'INITIATION', lastEventSeq: 1 });
    const year = new Date().getUTCFullYear();
    expect(result.data?.createNcr?.number).toBe(`NCR-${year}-${year === 2026 ? '009' : '001'}`);
    expect(
      await AuditEventModel.findOne({ entityId: result.data?.createNcr?.id }).lean(),
    ).toMatchObject({ actorUsername: testCredentials.username, actorRole: 'INSPECTOR' });
    expect(
      await AuditEventModel.countDocuments({
        entityType: 'NCR',
        entityId: result.data?.createNcr?.id,
      }),
    ).toBe(1);
    const bad = await gql(query, {
      input: { ...input, lotId: String(SeedService.fixtureId(4, 8)) },
    });
    expect(bad.errors?.[0]?.extensions.code).toBe('BAD_USER_INPUT');
  });

  it('allocates distinct annual numbers under concurrent creation, including suffixes above 999', async () => {
    const year = new Date().getUTCFullYear();
    await NcrModel.updateOne(
      { _id: SeedService.fixtureId(7, 8) },
      { $set: { number: `NCR-${year}-1000` } },
    );
    const input = {
      workOrderId: String(SeedService.fixtureId(5, 1)),
      operationStep: 20,
      lotId: String(SeedService.fixtureId(4, 1)),
      severity: 'MAJOR',
      defectCode: 'SEALING_DEFECT',
      detectionSource: 'Inspection',
      quantityAffected: 1,
      evidence: ['https://example.com/proof'],
    };
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        gql(
          'mutation Create($input: CreateNcrInput!) { createNcr(input: $input) { id number stage lastEventSeq } }',
          { input },
        ),
      ),
    );
    for (const result of results) expect(result.errors).toBeUndefined();
    expect(results.map((result) => result.data?.createNcr?.number).sort()).toEqual([
      `NCR-${year}-1001`,
      `NCR-${year}-1002`,
      `NCR-${year}-1003`,
    ]);
    expect(await NcrModel.countDocuments()).toBe(11);
    for (const result of results)
      expect(
        await AuditEventModel.countDocuments({
          entityId: result.data?.createNcr?.id,
          actorUsername: testCredentials.username,
        }),
      ).toBe(1);
  });

  it('rejects quantities beyond actual lot consumption without creating an NCR or event', async () => {
    const input = {
      workOrderId: String(SeedService.fixtureId(5, 1)),
      operationStep: 20,
      lotId: String(SeedService.fixtureId(4, 1)),
      severity: 'MAJOR',
      defectCode: 'SEALING_DEFECT',
      detectionSource: 'Inspection',
      quantityAffected: 99999,
      evidence: ['https://example.com/proof'],
    };
    const query =
      'mutation Create($input: CreateNcrInput!) { createNcr(input: $input) { id stage lastEventSeq } }';
    const count = await AuditEventModel.countDocuments();
    const invalid = await gql(query, { input });
    expect(invalid.errors?.[0]).toMatchObject({
      message: 'Quantity affected cannot exceed 12 for the selected material.',
      extensions: { code: 'BAD_USER_INPUT' },
    });
    expect(await NcrModel.countDocuments()).toBe(8);
    expect(await AuditEventModel.countDocuments()).toBe(count);
    const serialId = String(SeedService.fixtureId(6, 1));
    const duplicateSerials = await gql(query, {
      input: {
        workOrderId: input.workOrderId,
        operationStep: input.operationStep,
        severity: input.severity,
        defectCode: input.defectCode,
        detectionSource: input.detectionSource,
        evidence: input.evidence,
        serialIds: [serialId, serialId],
        quantityAffected: 2,
      },
    });
    expect(duplicateSerials.errors?.[0]?.message).toBe(
      'Quantity affected cannot exceed 1 for the selected material.',
    );
    expect(await NcrModel.countDocuments()).toBe(8);
    expect(
      (await gql(query, { input: { ...input, quantityAffected: 12 } })).errors,
    ).toBeUndefined();
    expect(await NcrModel.countDocuments()).toBe(9);
  });
  it('batches nested relations into a bounded number of MongoDB reads', async () => {
    let reads = 0;
    database.client.set('debug', (_collection, method) => {
      if (method === 'find' || method === 'findOne') reads += 1;
    });
    try {
      const result = await gql(`{
        ncrs { number site { code } workOrder { number } lot { supplier { name } certificate { number } } availableActions { action } events { seq } }
      }`);
      expect(result.errors).toBeUndefined();
      expect(reads).toBeLessThanOrEqual(9);
      expect(reads).toBeGreaterThan(0);
    } finally {
      database.client.set('debug', false);
    }
  });
  it('offers only consumed lots and rejects the original mismatched creation without writes', async () => {
    let lotReads = 0;
    database.client.set('debug', (collection, method) => {
      if (collection === 'lots' && method === 'find') lotReads += 1;
    });
    let options: z.infer<typeof responseSchema>;
    try {
      options = await gql('{ workOrders { id number lots { id lotNumber } } }');
    } finally {
      database.client.set('debug', false);
    }
    expect(options.errors).toBeUndefined();
    expect(options.data?.workOrders).toHaveLength(15);
    expect(lotReads).toBe(1);
    const order = options.data?.workOrders?.find((item) => item.number === 'WO-LYO-1049');
    const lot = order?.lots[0];
    if (!order || !lot) throw new Error('Expected the work order and its consumed lot.');
    expect(order.lots).toEqual([
      { id: String(SeedService.fixtureId(4, 3)), lotNumber: 'LOT-EL-2302' },
    ]);
    const auditCount = await AuditEventModel.countDocuments();
    const ncrCount = await NcrModel.countDocuments();
    const query =
      'mutation Create($input: CreateNcrInput!) { createNcr(input: $input) { id stage lastEventSeq } }';
    const input = {
      workOrderId: order.id,
      operationStep: 10,
      lotId: String(SeedService.fixtureId(4, 1)),
      severity: 'CRITICAL',
      defectCode: 'SEALING_DEFECT',
      detectionSource: 'Final inspection',
      quantityAffected: 1,
      evidence: ['https://example.com/evidence'],
    };
    const invalid = await gql(query, { input });
    expect(invalid.errors?.[0]?.extensions.code).toBe('BAD_USER_INPUT');
    expect(await AuditEventModel.countDocuments()).toBe(auditCount);
    expect(await NcrModel.countDocuments()).toBe(ncrCount);
    const valid = await gql(query, { input: { ...input, lotId: lot.id } });
    expect(valid.errors).toBeUndefined();
    expect(valid.data?.createNcr).toMatchObject({ stage: 'INITIATION', lastEventSeq: 1 });
    expect(await NcrModel.countDocuments()).toBe(ncrCount + 1);
    expect(await AuditEventModel.countDocuments()).toBe(auditCount + 1);
  });
});
