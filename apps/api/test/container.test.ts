import { testCredentials, TestApiConfig } from './credentials.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiContainer } from '../src/container.js';
import { ApiConfig } from '../src/config.js';
import { ApiApplication } from '../src/app.js';
import { Database } from '../src/db.js';
import { ModelRegistry } from '../src/models/ModelRegistry.js';
import { ContextFactory } from '../src/context.js';
import { ErpAdapter } from '../src/erp/ErpAdapter.js';

const containers: ApiContainer[] = [];

async function authenticatedRequest(container: ApiContainer, role?: string): Promise<Request> {
  const response = await container
    .get(ApiApplication)
    .create({ logging: false })
    .fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testCredentials.username,
        password: testCredentials.password,
      }),
    });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Expected an authenticated demo session.');
  return new Request('http://localhost/graphql', {
    headers: { cookie, ...(role ? { 'x-role': role } : {}) },
  });
}
afterEach(async () => {
  await Promise.all(containers.splice(0).map((container) => container.get(Database).disconnect()));
});

describe('API composition and dependency lifetimes', () => {
  it('shares application services within one container and isolates connections/models across containers', () => {
    const first = new ApiContainer(new TestApiConfig({ LOG_LEVEL: 'silent' }));
    const second = new ApiContainer(new TestApiConfig({ LOG_LEVEL: 'silent' }));
    containers.push(first, second);
    expect(first.get(ApiApplication)).toBe(first.get(ApiApplication));
    expect(first.get(ErpAdapter)).toBe(first.get(ErpAdapter));
    expect(first.get(Database)).not.toBe(second.get(Database));
    const firstModels = first.get(ModelRegistry);
    const secondModels = second.get(ModelRegistry);
    expect(firstModels.Ncr.db).toBe(first.get(Database).connection);
    expect(secondModels.Ncr.db).toBe(second.get(Database).connection);
    expect(firstModels.Ncr).not.toBe(secondModels.Ncr);
    expect(first.get(Database).available).toBe(false);
    expect(second.get(Database).available).toBe(false);
  });

  it('uses a rebound ERP dependency through the actual GraphQL application without opening a port', async () => {
    const container = new ApiContainer(new TestApiConfig({ LOG_LEVEL: 'silent' }));
    containers.push(container);
    const erp = new ErpAdapter();
    const getCatalog = vi.spyOn(erp, 'getCatalog').mockReturnValue({
      parts: [
        { partNumber: 'INJECTED-PART', description: 'Dependency override', revisions: ['A'] },
      ],
      purchaseOrders: [],
    });
    container.rebind(ErpAdapter).toConstantValue(erp);
    const headers = (await authenticatedRequest(container)).headers;
    headers.set('Content-Type', 'application/json');
    const response = await container
      .get(ApiApplication)
      .create()
      .fetch('http://localhost/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: '{ erpCatalog { parts { partNumber } } }' }),
      });
    const result = z
      .object({
        data: z.object({
          erpCatalog: z.object({ parts: z.array(z.object({ partNumber: z.string() })) }),
        }),
      })
      .parse(await response.json());
    expect(result.data.erpCatalog.parts).toEqual([{ partNumber: 'INJECTED-PART' }]);
    expect(getCatalog).toHaveBeenCalledOnce();
    expect(container.get(Database).available).toBe(false);
  });

  it('creates independent loader caches and roles for each request', async () => {
    const container = new ApiContainer();
    containers.push(container);
    const contexts = container.get(ContextFactory);
    const inspector = contexts.create(await authenticatedRequest(container));
    const production = contexts.create(await authenticatedRequest(container, 'PRODUCTION'));
    const lot = new (container.get(ModelRegistry).Lot)({ lotNumber: 'LOT-INJECTED' });
    const id = String(lot._id);
    inspector.loaders.lotById.prime(id, null);
    production.loaders.lotById.prime(id, lot);
    expect(inspector.role).toBe('INSPECTOR');
    expect(production.role).toBe('PRODUCTION');
    expect(await inspector.loaders.lotById.load(id)).toBeNull();
    expect(await production.loaders.lotById.load(id)).toBe(lot);
  });

  it('clears cached references so later mutation fields can observe committed data', async () => {
    const container = new ApiContainer();
    containers.push(container);
    const context = container.get(ContextFactory).create(await authenticatedRequest(container));
    const models = container.get(ModelRegistry);
    const lot = new models.Lot({ lotNumber: 'LOT-UPDATED' });
    const site = new models.Site({ code: 'LYO' });
    context.loaders.lotById.prime(String(lot._id), null);
    context.loaders.siteById.prime(String(site._id), null);
    context.loaders.clear();
    context.loaders.lotById.prime(String(lot._id), lot);
    context.loaders.siteById.prime(String(site._id), site);
    expect(await context.loaders.lotById.load(String(lot._id))).toBe(lot);
    expect(await context.loaders.siteById.load(String(site._id))).toBe(site);
  });

  it('rejects invalid persona headers at the request boundary', async () => {
    const container = new ApiContainer();
    containers.push(container);
    const request = await authenticatedRequest(container, 'ADMIN');
    expect(() => container.get(ContextFactory).create(request)).toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }) }),
    );
  });

  it('validates configuration per container before opening any connection', () => {
    expect(() => new ApiContainer(new TestApiConfig({ PORT: 'invalid' }))).toThrow();
    const config = new TestApiConfig({ PORT: '4100', STALE_NCR_DAYS: '9', SEED_ON_START: 'false' });
    const container = new ApiContainer(config);
    containers.push(container);
    expect(container.get(ApiConfig)).toBe(config);
    expect(config.values).toMatchObject({ PORT: 4100, STALE_NCR_DAYS: 9, SEED_ON_START: false });
    expect(container.get(Database).available).toBe(false);
  });

  it('validates the hosted frontend origin and configurable Node port', () => {
    const config = new TestApiConfig({
      PORT: '9981',
      FRONTEND_ORIGIN: 'https://example.com/',
      AUTH_COOKIE_SECURE: 'true',
    });
    expect(config.values).toMatchObject({
      PORT: 9981,
      FRONTEND_ORIGIN: 'https://example.com',
      AUTH_COOKIE_SECURE: true,
    });
    for (const origin of [
      '*',
      'https://example.com/dev/demo/connect-981/',
      'https://user:password@example.com',
    ])
      expect(() => new TestApiConfig({ FRONTEND_ORIGIN: origin })).toThrow();
  });

  it('validates temporary database mode without changing the external-storage default', () => {
    expect(new TestApiConfig({}).values.MONGO_IN_MEMORY).toBe(false);
    expect(new TestApiConfig({ MONGO_IN_MEMORY: 'true' }).values.MONGO_IN_MEMORY).toBe(true);
    expect(() => new TestApiConfig({ MONGO_IN_MEMORY: 'yes' })).toThrow();
  });
});
