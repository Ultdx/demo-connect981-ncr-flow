import { GraphQLClient, ClientError } from 'graphql-request';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { Variables } from 'graphql-request';
import type { Role } from './gql/graphql';
import { z } from 'zod';
import { sessionExpiredEvent } from './authClient';
import { ApiEndpoint } from './ApiEndpoint';

const errorExtensionsSchema = z.object({
  blockedBy: z.array(z.string()).optional().catch(undefined),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional()
    .catch(undefined),
});

export class ApiClient {
  request<TData, TVariables extends Variables>(
    document: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    role: Role,
    signal?: AbortSignal,
  ): Promise<TData> {
    // The API owns all permission checks; the header is only a demo persona.
    // The wrapper binds the document's variables above; the transport only needs
    // the common object shape, including operations with an empty variable set.
    const endpoint = ApiEndpoint.url('graphql');
    return (
      new GraphQLClient(endpoint, { credentials: 'include', headers: { 'x-role': role } })
        .request<TData, Variables>({
          document,
          variables,
          signal,
        })
        // eslint-disable-next-line @typescript-eslint/no-restricted-types -- Promise rejections are untrusted; narrow before inspecting an HTTP response.
        .catch((cause: unknown) => {
          if (!signal?.aborted && cause instanceof ClientError && cause.response.status === 401)
            window.dispatchEvent(new Event(sessionExpiredEvent));
          throw cause;
        })
    );
  }

  // JavaScript promises can reject with arbitrary values; narrow at this error boundary.
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- Promise rejection values have no guaranteed shape.
  static errorMessage(error: unknown): string {
    if (error instanceof ClientError) {
      return (
        (error.response.errors ?? [])
          .map((item) => {
            const parsed = errorExtensionsSchema.safeParse(item.extensions ?? {});
            const extensions = parsed.success ? parsed.data : undefined;
            return [
              item.message,
              ...(extensions?.blockedBy ?? []),
              ...(extensions?.issues?.map((issue) => `${issue.path}: ${issue.message}`) ?? []),
            ].join(' ');
          })
          .join(' ') || 'The API could not complete this request.'
      );
    }
    return error instanceof Error ? error.message : 'An unexpected error occurred.';
  }
}
export const apiClient = new ApiClient();
