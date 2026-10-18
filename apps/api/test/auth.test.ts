import { testCredentials, TestApiConfig } from './credentials.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiContainer } from '../src/container.js';
import { ApiApplication } from '../src/app.js';
import { Database } from '../src/db.js';
import { ContextFactory } from '../src/context.js';

const containers: ApiContainer[] = [];
const loginBody = JSON.stringify({
  username: testCredentials.username,
  password: testCredentials.password,
});
const sessionSchema = z.object({ username: z.string() });

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(containers.splice(0).map((container) => container.get(Database).disconnect()));
});

describe('demo HTTP authentication', () => {
  it('authenticates the configured account and reports that user in the session and request context', async () => {
    const configured = {
      username: 'alternate-test-user',
      password: `${testCredentials.password}-alternate`,
    };
    const container = new ApiContainer(
      new TestApiConfig({
        DEMO_USERNAME: configured.username,
        DEMO_PASSWORD: configured.password,
      }),
    );
    containers.push(container);
    const app = container.get(ApiApplication).create({ logging: false });
    const rejected = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody,
    });
    expect(rejected.status).toBe(401);
    expect(rejected.headers.has('set-cookie')).toBe(false);
    const login = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configured),
    });
    expect(login.status).toBe(200);
    expect(sessionSchema.parse(await login.json()).username).toBe(configured.username);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('Expected a session cookie.');
    const session = await app.fetch('http://localhost/auth/session', { headers: { cookie } });
    expect(sessionSchema.parse(await session.json()).username).toBe(configured.username);
    expect(
      container
        .get(ContextFactory)
        .create(new Request('http://localhost/graphql', { headers: { cookie } })).username,
    ).toBe(configured.username);
  });

  it.each(['/auth/login', '/auth/session', '/auth/logout', '/graphql'])(
    'allows credentialed browser preflight from example.com for %s without a session',
    async (path) => {
      const container = new ApiContainer(
        new TestApiConfig({
          FRONTEND_ORIGIN: 'https://example.com',
          AUTH_COOKIE_SECURE: 'true',
          PORT: '9981',
        }),
      );
      containers.push(container);
      const response = await container
        .get(ApiApplication)
        .create()
        .fetch(`http://demo.example.com${path}`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://example.com',
            'Access-Control-Request-Method': path === '/auth/session' ? 'GET' : 'POST',
            'Access-Control-Request-Headers': 'content-type,x-role',
          },
        });
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type, X-Role');
      expect(response.headers.get('vary')).toContain('Origin');
      expect(response.headers.has('set-cookie')).toBe(false);
    },
  );

  it('logs in across the two public origins and sends CORS headers on session and GraphQL errors', async () => {
    const container = new ApiContainer(
      new TestApiConfig({ FRONTEND_ORIGIN: 'https://example.com/', AUTH_COOKIE_SECURE: 'true' }),
    );
    containers.push(container);
    const app = container.get(ApiApplication).create({ logging: false });
    const origin = 'https://example.com';
    const denied = await app.fetch('http://demo.example.com/graphql', {
      headers: { Origin: origin },
    });
    expect(denied.status).toBe(401);
    expect(denied.headers.get('access-control-allow-origin')).toBe(origin);
    expect(denied.headers.get('access-control-allow-credentials')).toBe('true');
    const invalid = await app.fetch('http://demo.example.com/auth/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testCredentials.username, password: 'wrong' }),
    });
    expect(invalid.status).toBe(401);
    expect(invalid.headers.get('access-control-allow-origin')).toBe(origin);
    const login = await app.fetch('http://demo.example.com/auth/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: loginBody,
    });
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
    expect(login.headers.get('set-cookie')).toContain('; Secure');
    expect(login.headers.get('set-cookie')).not.toContain('Domain=');
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const session = await app.fetch('http://demo.example.com/auth/session', {
      headers: { Origin: origin, cookie },
    });
    expect(session.status).toBe(200);
    expect(session.headers.get('access-control-allow-credentials')).toBe('true');
    const query = await app.fetch('http://demo.example.com/graphql', {
      method: 'POST',
      headers: { Origin: origin, cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ erpCatalog { parts { partNumber } } }' }),
    });
    expect(query.status).toBe(200);
    expect(query.headers.get('access-control-allow-origin')).toBe(origin);
    const logout = await app.fetch('http://demo.example.com/auth/logout', {
      method: 'POST',
      headers: { Origin: origin, cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(logout.status).toBe(200);
    expect(
      (
        await app.fetch('http://demo.example.com/auth/session', {
          headers: { Origin: origin, cookie },
        })
      ).status,
    ).toBe(401);
  });

  it.each([
    'https://foreign.example',
    'https://example.com.evil.example',
    'https://other.example.com',
    'http://example.com',
    'https://example.com:9981',
    'null',
  ])('rejects non-allowlisted origin %s including preflight and read requests', async (origin) => {
    const container = new ApiContainer(
      new TestApiConfig({ FRONTEND_ORIGIN: 'https://example.com' }),
    );
    containers.push(container);
    const app = container.get(ApiApplication).create();
    for (const method of ['OPTIONS', 'GET']) {
      const response = await app.fetch('http://demo.example.com/auth/session', {
        method,
        headers: { Origin: origin },
      });
      expect(response.status).toBe(403);
      expect(response.headers.has('access-control-allow-origin')).toBe(false);
      expect(response.headers.has('set-cookie')).toBe(false);
    }
  });

  it.each([
    { method: 'DELETE', headers: 'content-type' },
    { method: 'POST', headers: 'authorization' },
  ])('rejects unsupported preflight $method/$headers', async (preflight) => {
    const container = new ApiContainer(
      new TestApiConfig({ FRONTEND_ORIGIN: 'https://example.com' }),
    );
    containers.push(container);
    const response = await container
      .get(ApiApplication)
      .create()
      .fetch('http://demo.example.com/graphql', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': preflight.method,
          'Access-Control-Request-Headers': preflight.headers,
        },
      });
    expect(response.status).toBe(403);
  });

  it.each([
    { method: 'POST', body: JSON.stringify({ query: '{ __schema { queryType { name } } }' }) },
    {
      method: 'POST',
      body: JSON.stringify({
        query:
          'mutation { containLot(input: { lotNumber: "LOT", reason: "test" }) { lotsPlacedOnHold } }',
      }),
    },
    { method: 'GET', body: undefined },
  ])(
    'blocks unauthenticated GraphQL $method requests even with a persona header',
    async ({ method, body }) => {
      const container = new ApiContainer();
      containers.push(container);
      const response = await container
        .get(ApiApplication)
        .create()
        .fetch('http://localhost/graphql', {
          method,
          body,
          headers: { 'Content-Type': 'application/json', 'x-role': 'QUALITY' },
        });
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(container.get(Database).available).toBe(false);
      expect(() =>
        container.get(ContextFactory).create(new Request('http://localhost/graphql')),
      ).toThrow(
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
        }),
      );
    },
  );

  it('logs in, restores the session, permits GraphQL, and revokes it on logout', async () => {
    const container = new ApiContainer();
    containers.push(container);
    const app = container.get(ApiApplication).create({ logging: false });
    const login = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
      body: loginBody,
    });
    expect(login.status).toBe(200);
    expect(sessionSchema.parse(await login.json())).toEqual({ username: testCredentials.username });
    const setCookie = login.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(
      /ncr_demo_session=[a-f\d]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800/,
    );
    const cookie = setCookie.split(';')[0]!;
    const session = await app.fetch('http://localhost/auth/session', { headers: { cookie } });
    expect(session.status).toBe(200);
    expect(sessionSchema.parse(await session.json()).username).toBe(testCredentials.username);
    const query = await app.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ query: '{ erpCatalog { parts { partNumber } } }' }),
    });
    expect(query.status).toBe(200);
    const data = z
      .object({
        data: z.object({
          erpCatalog: z.object({ parts: z.array(z.object({ partNumber: z.string() })) }),
        }),
      })
      .parse(await query.json());
    expect(data.data.erpCatalog.parts.length).toBeGreaterThan(0);
    const logout = await app.fetch('http://localhost/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: '{}',
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await app.fetch('http://localhost/auth/session', { headers: { cookie } })).status).toBe(
      401,
    );
    expect((await app.fetch('http://localhost/graphql', { headers: { cookie } })).status).toBe(401);
  });

  it.each([
    { username: testCredentials.username, password: 'incorrect' },
    { username: 'other', password: testCredentials.password },
  ])('rejects an invalid credential pair without creating a cookie', async (credentials) => {
    const container = new ApiContainer();
    containers.push(container);
    const response = await container
      .get(ApiApplication)
      .create()
      .fetch('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    expect(response.status).toBe(401);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('rejects forged cookies and expires sessions after eight hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const container = new ApiContainer();
    containers.push(container);
    const app = container.get(ApiApplication).create();
    expect(
      (
        await app.fetch('http://localhost/auth/session', {
          headers: { cookie: `ncr_demo_session=${'f'.repeat(64)}` },
        })
      ).status,
    ).toBe(401);
    const login = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody,
    });
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    vi.setSystemTime(Date.now() + 8 * 60 * 60 * 1000);
    expect((await app.fetch('http://localhost/auth/session', { headers: { cookie } })).status).toBe(
      401,
    );
  });

  it('rotates a pre-existing session and rejects the old token', async () => {
    const container = new ApiContainer();
    containers.push(container);
    const app = container.get(ApiApplication).create();
    const first = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody,
    });
    const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
    const second = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: loginBody,
    });
    expect(second.headers.get('set-cookie')).not.toBe(first.headers.get('set-cookie'));
    expect((await app.fetch('http://localhost/auth/session', { headers: { cookie } })).status).toBe(
      401,
    );
  });

  it('enables Secure cookies for HTTPS hosting and accepts a public origin behind a proxy', async () => {
    const container = new ApiContainer(new TestApiConfig({ AUTH_COOKIE_SECURE: 'true' }));
    containers.push(container);
    const login = await container
      .get(ApiApplication)
      .create()
      .fetch('http://demo.example/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://demo.example' },
        body: loginBody,
      });
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('; Secure');
  });

  it.each(['/auth/login', '/auth/logout', '/graphql'])(
    'rejects a foreign origin on %s',
    async (path) => {
      const container = new ApiContainer();
      containers.push(container);
      const response = await container
        .get(ApiApplication)
        .create()
        .fetch(`http://localhost${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' },
          body: loginBody,
        });
      expect(response.status).toBe(403);
      expect(response.headers.has('set-cookie')).toBe(false);
    },
  );

  it('rejects malformed credentials, non-JSON login, and incorrect HTTP methods', async () => {
    const container = new ApiContainer();
    containers.push(container);
    const app = container.get(ApiApplication).create();
    expect(
      (await app.fetch('http://localhost/auth/login', { method: 'POST', body: loginBody })).status,
    ).toBe(415);
    expect(
      (
        await app.fetch('http://localhost/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid',
        })
      ).status,
    ).toBe(400);
    const wrongMethod = await app.fetch('http://localhost/auth/logout');
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('POST');
  });

  it('throttles repeated failed logins and permits retry after the window expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const container = new ApiContainer();
    containers.push(container);
    const app = container.get(ApiApplication).create();
    for (let index = 0; index < 10; index += 1) {
      const response = await app.fetch('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testCredentials.username, password: 'wrong' }),
      });
      expect(response.status).toBe(401);
    }
    const limited = await app.fetch('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginBody,
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    vi.setSystemTime(Date.now() + 60_000);
    expect(
      (
        await app.fetch('http://localhost/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: loginBody,
        })
      ).status,
    ).toBe(200);
  });
});
