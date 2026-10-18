import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { Variables } from 'graphql-request';
import { apiClient, ApiClient } from './api';
import { useSession } from './session';

interface QueryResult<TData> {
  data: TData | undefined;
  error: string;
  loading: boolean;
  reload: () => void;
}

/** Pass memoized variables so unrelated renders do not restart the request. */
export function useGql<TData, TVariables extends Variables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables: TVariables,
): QueryResult<TData> {
  const { role } = useSession();
  const [revision, setRevision] = useState(0);
  const request = useMemo(
    () => ({ document, variables, role, revision }),
    [document, variables, role, revision],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    data: TData | undefined;
    error: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .request(request.document, request.variables, request.role, controller.signal)
      .then((data) => {
        // Check the signal as well as aborting: a transport may complete while
        // cancellation is being processed, or may not support it at all.
        if (!controller.signal.aborted) setResult({ request, data, error: '' });
      })
      // eslint-disable-next-line @typescript-eslint/no-restricted-types -- Narrow untrusted rejection values in errorMessage.
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setResult({ request, data: undefined, error: ApiClient.errorMessage(cause) });
      });
    return () => controller.abort();
  }, [request]);
  // A new request is pending immediately, before its effect starts. Never expose
  // a previous record's data, permissions, or errors under the new inputs/role.
  const current = result?.request === request ? result : undefined;
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    data: current?.data,
    error: current?.error ?? '',
    loading: current === undefined,
    reload,
  };
}
