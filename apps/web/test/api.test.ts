import { describe, expect, it } from 'vitest';
import { GraphQLError } from 'graphql';
import { ClientError } from 'graphql-request';
import { ApiClient } from '../src/api';

describe('client error boundary', () => {
  it.each([
    {
      extensions: {
        blockedBy: ['Provide a reason.'],
        issues: [{ path: 'reason', message: 'Required.' }],
      },
      expected: 'Command blocked. Provide a reason. reason: Required.',
    },
    {
      extensions: { blockedBy: [42], issues: 'malformed upstream response' },
      expected: 'Command blocked.',
    },
    { extensions: {}, expected: 'Command blocked.' },
  ])(
    'renders validated error details without trusting arbitrary extensions',
    ({ extensions, expected }) => {
      const error = new ClientError(
        {
          status: 200,
          headers: new Headers(),
          body: '',
          errors: [new GraphQLError('Command blocked.', { extensions })],
        },
        { query: 'mutation { transitionNcr }' },
      );
      expect(ApiClient.errorMessage(error)).toBe(expected);
    },
  );

  it('preserves transport error messages', () => {
    expect(ApiClient.errorMessage(new TypeError('Failed to fetch.'))).toBe('Failed to fetch.');
  });

  it('handles rejection values that are not Error instances', () => {
    expect(ApiClient.errorMessage({ problem: 'untrusted value' })).toBe(
      'An unexpected error occurred.',
    );
    expect(ApiClient.errorMessage(null)).toBe('An unexpected error occurred.');
  });
});
