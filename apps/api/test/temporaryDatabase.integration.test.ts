import { testCredentials, TestApiConfig } from './credentials.js';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiContainer } from '../src/container.js';
import { ApiApplication } from '../src/app.js';
import { Database } from '../src/db.js';
import { ModelRegistry } from '../src/models/ModelRegistry.js';
import { SeedService } from '../seed/data.js';

const containers: ApiContainer[] = [];
const config = new TestApiConfig({
  MONGO_IN_MEMORY: 'true',
  // An old deployment URI must be ignored in automatic temporary mode.
  MONGO_URI: 'deliberately-unreachable-test-uri',
  LOG_LEVEL: 'silent',
});

afterEach(async () => {
  await Promise.all(containers.splice(0).map((container) => container.get(Database).disconnect()));
});

describe('automatically managed demo database', () => {
  it('seeds, commits an authenticated transaction, removes storage on shutdown, and resets on restart', async () => {
    const container = new ApiContainer(config);
    containers.push(container);
    const application = container.get(ApiApplication);
    const database = container.get(Database);
    const models = container.get(ModelRegistry);
    expect(await application.initialize()).toBe(true);
    expect(await models.Ncr.countDocuments()).toBe(8);
    // Validate the database's runtime command response before inspecting its storage path.
    const storage = z
      .object({ parsed: z.object({ storage: z.object({ dbPath: z.string() }) }) })
      .parse(await database.connection.db!.admin().command({ getCmdLineOpts: 1 }));
    const dbPath = storage.parsed.storage.dbPath;
    expect(existsSync(dbPath)).toBe(true);
    const app = application.create({ logging: false });
    const login = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testCredentials.username,
        password: testCredentials.password,
      }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('Expected a demo login cookie.');
    const id = String(SeedService.fixtureId(7, 1));
    const response = await app.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-role': 'PRODUCTION', cookie },
      body: JSON.stringify({
        query:
          'mutation Advance($input: TransitionNcrInput!) { transitionNcr(input: $input) { stage lastEventSeq } }',
        variables: {
          input: {
            ncrId: id,
            action: 'CONTAIN',
            expectedSeq: 2,
            payload: { containmentAction: 'Segregated for the hosted demo.' },
          },
        },
      }),
    });
    const result = z
      .object({
        data: z.object({
          transitionNcr: z.object({ stage: z.literal('MRB_REVIEW'), lastEventSeq: z.literal(3) }),
        }),
      })
      .parse(await response.json());
    expect(response.status).toBe(200);
    expect(result.data.transitionNcr.stage).toBe('MRB_REVIEW');
    expect(await models.AuditEvent.countDocuments({ entityType: 'NCR', entityId: id })).toBe(3);
    await database.disconnect();
    expect(database.available).toBe(false);
    expect(existsSync(dbPath)).toBe(false);

    // A PM2 restart creates a fresh container/process with the initial scenario.
    const restarted = new ApiContainer(config);
    containers.push(restarted);
    expect(await restarted.get(ApiApplication).initialize()).toBe(true);
    const restartedModels = restarted.get(ModelRegistry);
    expect(await restartedModels.Ncr.countDocuments()).toBe(8);
    expect((await restartedModels.Ncr.findById(id))?.stage).toBe('CONTAINMENT');
    expect(
      await restartedModels.AuditEvent.countDocuments({ entityType: 'NCR', entityId: id }),
    ).toBe(2);
  });

  it('keeps an explicitly shared database alive when a borrowing application disconnects', async () => {
    const owner = new ApiContainer(config);
    const borrower = new ApiContainer(config);
    containers.push(owner, borrower);
    await owner.get(ApiApplication).initialize();
    const database = owner.get(Database);
    await borrower
      .get(ApiApplication)
      .initialize(
        `mongodb://${database.connection.host}:${database.connection.port}/ncrflow?directConnection=true`,
        false,
      );
    expect(await borrower.get(ModelRegistry).Ncr.countDocuments()).toBe(8);
    await borrower.get(Database).disconnect();
    expect(database.available).toBe(true);
    expect(await owner.get(ModelRegistry).Ncr.countDocuments()).toBe(8);
  });
});
