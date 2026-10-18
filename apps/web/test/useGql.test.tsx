// @vitest-environment jsdom
import { useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { parse } from 'graphql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { apiClient } from '../src/api';
import { Role } from '../src/gql/graphql';
import { useSession } from '../src/session';
import { useGql } from '../src/useGql';

vi.mock('../src/session', () => ({ useSession: vi.fn() }));

interface QueryData {
  workOrders: { site: { code: string } }[];
}
type QueryVariables = { siteId: string };
const sitesDocument: TypedDocumentNode<QueryData, QueryVariables> = parse(
  'query Sites($siteId: ID!) { workOrders(siteId: $siteId) { site { code } } }',
);
const alternateDocument: TypedDocumentNode<QueryData, QueryVariables> = parse(
  'query SitesAgain($siteId: ID!) { workOrders(siteId: $siteId) { site { code } } }',
);
const lyon: QueryData = { workOrders: [{ site: { code: 'LYO' } }] };
const montreal: QueryData = { workOrders: [{ site: { code: 'MTL' } }] };
const request = vi.spyOn(apiClient, 'request');

// Controlled completion order deliberately models transports that finish even
// after cancellation, so the tests cover more than fetch's own abort behavior.
class PendingQuery {
  readonly promise: Promise<QueryData>;
  resolve!: (data: QueryData) => void;
  reject!: (error: Error) => void;

  constructor() {
    this.promise = new Promise<QueryData>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

interface QueryProps {
  siteId: string;
  document?: TypedDocumentNode<QueryData, QueryVariables>;
}
function useTestQuery({
  siteId,
  document = sitesDocument,
}: QueryProps): ReturnType<typeof useGql<QueryData, QueryVariables>> {
  const variables = useMemo(() => ({ siteId }), [siteId]);
  return useGql(document, variables);
}

beforeEach(() => {
  request.mockReset();
  vi.mocked(useSession).mockReturnValue({ role: Role.Inspector, setRole: vi.fn() });
});
afterEach(cleanup);

describe('GraphQL query lifecycle', () => {
  it('loads typed data and does not restart on an equivalent render', async () => {
    const pending = new PendingQuery();
    request.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    const reload = result.current.reload;
    expect(result.current).toMatchObject({ data: undefined, loading: true, error: '' });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      sitesDocument,
      { siteId: 'LYO' },
      Role.Inspector,
      expect.any(AbortSignal),
    );
    await act(async () => pending.resolve(lyon));
    expect(result.current).toMatchObject({ data: lyon, loading: false, error: '' });
    rerender({ siteId: 'LYO' });
    expect(request).toHaveBeenCalledOnce();
    expect(result.current.reload).toBe(reload);
  });

  it('aborts the old filter request and ignores its late success', async () => {
    const first = new PendingQuery();
    const second = new PendingQuery();
    request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    const firstSignal = request.mock.calls[0]?.[3];
    rerender({ siteId: 'MTL' });
    expect(firstSignal?.aborted).toBe(true);
    expect(request.mock.calls[1]?.[1]).toEqual({ siteId: 'MTL' });
    await act(async () => second.resolve(montreal));
    await act(async () => first.resolve(lyon));
    expect(result.current).toMatchObject({ data: montreal, loading: false, error: '' });
  });

  it('does not let an abandoned failure end a newer pending request', async () => {
    const first = new PendingQuery();
    const second = new PendingQuery();
    request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    rerender({ siteId: 'MTL' });
    await act(async () => first.reject(new Error('Old transport failed.')));
    expect(result.current).toMatchObject({ data: undefined, loading: true, error: '' });
    await act(async () => second.resolve(montreal));
    expect(result.current).toMatchObject({ data: montreal, loading: false, error: '' });
  });

  it('hides previous data as soon as the query variables change', async () => {
    const second = new PendingQuery();
    request.mockResolvedValueOnce(lyon).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    await waitFor(() => expect(result.current.data).toEqual(lyon));
    rerender({ siteId: 'MTL' });
    expect(result.current).toMatchObject({ data: undefined, loading: true, error: '' });
    await act(async () => second.resolve(montreal));
    expect(result.current.data).toEqual(montreal);
  });

  it('reloads with the new role and hides the previous role result', async () => {
    const second = new PendingQuery();
    request.mockResolvedValueOnce(lyon).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    await waitFor(() => expect(result.current.data).toEqual(lyon));
    const firstSignal = request.mock.calls[0]?.[3];
    vi.mocked(useSession).mockReturnValue({ role: Role.Quality, setRole: vi.fn() });
    rerender({ siteId: 'LYO' });
    expect(firstSignal?.aborted).toBe(true);
    expect(request.mock.calls[1]?.[2]).toBe(Role.Quality);
    expect(result.current).toMatchObject({ data: undefined, loading: true, error: '' });
    await act(async () => second.resolve(montreal));
    expect(result.current.data).toEqual(montreal);
  });

  it('ignores a late response from the previous persona', async () => {
    const first = new PendingQuery();
    const second = new PendingQuery();
    request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    vi.mocked(useSession).mockReturnValue({ role: Role.Production, setRole: vi.fn() });
    rerender({ siteId: 'LYO' });
    await act(async () => second.resolve(montreal));
    await act(async () => first.resolve(lyon));
    expect(result.current.data).toEqual(montreal);
  });

  it('reloads explicitly, cancels pending work, and resets an earlier error', async () => {
    const pending = new PendingQuery();
    const refreshed = new PendingQuery();
    request
      .mockRejectedValueOnce(new Error('API unavailable.'))
      .mockReturnValueOnce(pending.promise)
      .mockReturnValueOnce(refreshed.promise);
    const { result } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
    await waitFor(() => expect(result.current.error).toBe('API unavailable.'));
    expect(result.current.loading).toBe(false);
    act(() => result.current.reload());
    expect(result.current).toMatchObject({ data: undefined, loading: true, error: '' });
    const pendingSignal = request.mock.calls[1]?.[3];
    act(() => result.current.reload());
    expect(pendingSignal?.aborted).toBe(true);
    await act(async () => pending.resolve(lyon));
    expect(result.current.loading).toBe(true);
    await act(async () => refreshed.resolve(montreal));
    expect(result.current).toMatchObject({ data: montreal, loading: false, error: '' });
  });

  it('cancels the request when the GraphQL document changes', async () => {
    const first = new PendingQuery();
    const second = new PendingQuery();
    request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useTestQuery, {
      initialProps: { siteId: 'LYO', document: sitesDocument },
    });
    const firstSignal = request.mock.calls[0]?.[3];
    rerender({ siteId: 'LYO', document: alternateDocument });
    expect(firstSignal?.aborted).toBe(true);
    expect(request.mock.calls[1]?.[0]).toBe(alternateDocument);
    await act(async () => first.resolve(lyon));
    expect(result.current.loading).toBe(true);
    await act(async () => second.resolve(montreal));
    expect(result.current.data).toEqual(montreal);
  });

  it.each(['resolve', 'reject'] as const)(
    'aborts on unmount and ignores late %s',
    async (completion) => {
      const pending = new PendingQuery();
      request.mockReturnValueOnce(pending.promise);
      const { result, unmount } = renderHook(useTestQuery, { initialProps: { siteId: 'LYO' } });
      const previous = result.current;
      const signal = request.mock.calls[0]?.[3];
      unmount();
      expect(signal?.aborted).toBe(true);
      await act(async () => {
        if (completion === 'resolve') pending.resolve(lyon);
        else pending.reject(new DOMException('Request aborted.', 'AbortError'));
      });
      expect(result.current).toBe(previous);
    },
  );

  it('survives StrictMode cleanup and preserves the replacement request', async () => {
    const first = new PendingQuery();
    const second = new PendingQuery();
    request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(useTestQuery, {
      initialProps: { siteId: 'LYO' },
      reactStrictMode: true,
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[3]?.aborted).toBe(true);
    expect(request.mock.calls[1]?.[3]?.aborted).toBe(false);
    await act(async () => first.reject(new DOMException('Request aborted.', 'AbortError')));
    expect(result.current).toMatchObject({ data: undefined, loading: true, error: '' });
    await act(async () => second.resolve(lyon));
    expect(result.current).toMatchObject({ data: lyon, loading: false, error: '' });
  });
});
