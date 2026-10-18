// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/api';
import { CreationOptionsDocument, Role, type CreationOptionsQuery } from '../src/gql/graphql';
import { sessionExpiredEvent } from '../src/authClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GraphQL transport cancellation', () => {
  it.each(['https://demo.example.com/', 'https://demo.example.com:9981'])(
    'uses the configured API %s independently of the frontend base',
    async (apiUrl) => {
      vi.stubEnv('BASE_URL', '/dev/demo/connect-981/');
      vi.stubEnv('VITE_API_URL', apiUrl);
      const data: CreationOptionsQuery = { workOrders: [], erpCatalog: { parts: [] } };
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify({ data }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetch);
      await new ApiClient().request(CreationOptionsDocument, {}, Role.Inspector);
      expect(String(fetch.mock.calls[0]?.[0])).toBe(`${apiUrl.replace(/\/$/, '')}/graphql`);
      expect(fetch.mock.calls[0]?.[1]?.credentials).toBe('include');
    },
  );

  it.each([false, true])(
    'reports an unauthorized response unless the request was aborted (%s)',
    async (aborted) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof globalThis.fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({
              errors: [
                { message: 'Sign in to access the demo.', extensions: { code: 'UNAUTHENTICATED' } },
              ],
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
      const expired = vi.fn();
      window.addEventListener(sessionExpiredEvent, expired);
      const controller = new AbortController();
      if (aborted) controller.abort();
      try {
        await expect(
          new ApiClient().request(CreationOptionsDocument, {}, Role.Inspector, controller.signal),
        ).rejects.toThrow();
        expect(expired).toHaveBeenCalledTimes(aborted ? 0 : 1);
      } finally {
        window.removeEventListener(sessionExpiredEvent, expired);
      }
    },
  );

  it.each(['/', '/dev/demo/connect-981/'])(
    'uses the %s base and forwards the request signal and persona',
    async (base) => {
      vi.stubEnv('BASE_URL', base);
      vi.stubEnv('VITE_API_URL', '');
      const data: CreationOptionsQuery = { workOrders: [], erpCatalog: { parts: [] } };
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify({ data }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetch);
      const controller = new AbortController();
      const result = await new ApiClient().request(
        CreationOptionsDocument,
        {},
        Role.Inspector,
        controller.signal,
      );
      expect(result).toEqual(data);
      const [endpoint, init] = fetch.mock.calls[0] ?? [];
      expect(String(endpoint)).toBe(new URL(`${base}graphql`, window.location.origin).href);
      expect(init?.signal).toBe(controller.signal);
      expect(init?.credentials).toBe('include');
      expect(new Headers(init?.headers).get('x-role')).toBe(Role.Inspector);
      controller.abort();
      expect(init?.signal?.aborted).toBe(true);
    },
  );

  it('rejects with AbortError when the in-flight fetch is cancelled', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Request aborted.', 'AbortError'));
            },
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const pending = new ApiClient().request(
      CreationOptionsDocument,
      {},
      Role.Quality,
      controller.signal,
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    controller.abort();
    await rejected;
    expect(fetch).toHaveBeenCalledOnce();
  });
});
