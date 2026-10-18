import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          setupFiles: ['apps/api/test/setup.ts'],
          include: ['apps/api/test/**/*.test.ts', 'apps/web/test/**/*.test.{ts,tsx}'],
          exclude: ['**/*.integration.test.ts'],
        },
      },
      {
        // Yoga is externalized by Vitest. Share its GraphQL entry point so a
        // transformed resolver's GraphQLError has the same runtime constructor.
        resolve: { alias: [{ find: /^graphql$/, replacement: require.resolve('graphql') }] },
        test: {
          name: 'integration',
          setupFiles: ['apps/api/test/setup.ts'],
          include: ['apps/api/test/**/*.integration.test.ts'],
          hookTimeout: 180_000,
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
