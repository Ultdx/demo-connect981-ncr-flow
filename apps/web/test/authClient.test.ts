// @vitest-environment jsdom
import { testCredentials } from '../../api/test/credentials';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthClient } from '../src/authClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('demo authentication transport', () => {
  it.each(['https://demo.example.com/', 'https://demo.example.com:9981'])(
    'uses the API %s and includes cookies for the complete authentication flow',
    async (apiUrl) => {
      vi.stubEnv('BASE_URL', '/dev/demo/connect-981/');
      vi.stubEnv('VITE_API_URL', apiUrl);
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response(JSON.stringify({ username: testCredentials.username })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ username: testCredentials.username })))
        .mockResolvedValueOnce(new Response('{}'));
      vi.stubGlobal('fetch', fetch);
      const client = new AuthClient();
      await client.login(testCredentials.username, testCredentials.password);
      await client.session();
      await client.logout();
      expect(fetch.mock.calls.map(([url]) => url)).toEqual(
        ['auth/login', 'auth/session', 'auth/logout'].map(
          (path) => `${apiUrl.replace(/\/$/, '')}/${path}`,
        ),
      );
      for (const [, options] of fetch.mock.calls) expect(options?.credentials).toBe('include');
    },
  );

  it('uses the hosted subpath for login, session restoration, and logout', async () => {
    vi.stubEnv('BASE_URL', '/dev/demo/connect-981/');
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: testCredentials.username })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: testCredentials.username })))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const client = new AuthClient();
    await client.login(testCredentials.username, testCredentials.password);
    await client.session();
    await client.logout();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(
      [
        '/dev/demo/connect-981/auth/login',
        '/dev/demo/connect-981/auth/session',
        '/dev/demo/connect-981/auth/logout',
      ].map((path) => new URL(path, window.location.origin).href),
    );
  });

  it('sends credentials only in the login body and includes the session cookie', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ username: testCredentials.username }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await new AuthClient().login(testCredentials.username, testCredentials.password)).toBe(
      testCredentials.username,
    );
    const [url, options] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(new URL('/auth/login', window.location.origin).href);
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      username: testCredentials.username,
      password: testCredentials.password,
    });
  });

  it('returns no user for an expired session and forwards probe cancellation', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    expect(await new AuthClient().session(controller.signal)).toBeNull();
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      signal: controller.signal,
      credentials: 'include',
    });
  });

  it('displays API login errors without accepting a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid username or password.' }), {
          status: 401,
        }),
      ),
    );
    await expect(new AuthClient().login(testCredentials.username, 'wrong')).rejects.toThrow(
      'Invalid username or password.',
    );
  });

  it('rejects malformed successful session responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ username: null }))),
    );
    await expect(new AuthClient().session()).rejects.toThrow();
  });

  it('requires API confirmation to complete logout', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const client = new AuthClient();
    await expect(client.logout()).rejects.toThrow('Unable to sign out. Please try again.');
    await expect(client.logout()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenLastCalledWith(
      new URL('/auth/logout', window.location.origin).href,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
