import { readFileSync } from 'node:fs';
import { createSchema, createYoga, type YogaServerInstance } from 'graphql-yoga';
import { ContextFactory, type Context } from './context.js';
import { ApiResolvers } from './resolvers/index.js';
import { ApiConfig } from './config.js';

import { Database } from './db.js';
import { ModelRegistry } from './models/ModelRegistry.js';
import { SeedService } from '../seed/data.js';
import { DemoAuth } from './auth/DemoAuth.js';

const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8');

export class ApiApplication {
  constructor(
    private readonly database: Database,
    private readonly models: ModelRegistry,
    private readonly seed: SeedService,
    private readonly contexts: ContextFactory,
    private readonly resolvers: ApiResolvers,
    private readonly config: ApiConfig,
    private readonly auth: DemoAuth,
  ) {}

  async initialize(
    uri?: string,
    seed: boolean = this.config.values.SEED_ON_START,
  ): Promise<boolean> {
    await this.database.connect(uri);
    await this.models.initialize();
    return seed ? this.seed.seed() : false;
  }

  create(
    options: { graphiql?: boolean; logging?: boolean } = {},
  ): YogaServerInstance<object, Context> {
    // The factory does not listen or connect to MongoDB, so integration tests can
    // exercise the real HTTP/GraphQL boundary through yoga.fetch without a port.
    return createYoga<object, Context>({
      plugins: [
        {
          onRequest: async ({ request, url, endResponse }) => {
            const response = await this.auth.handle(request, url);
            if (response) endResponse(response);
          },
          onResponse: ({ request, response }) => {
            response.headers.set('Cache-Control', 'no-store');
            this.auth.cors(request, response.headers);
          },
        },
      ],
      schema: createSchema<Context>({ typeDefs, resolvers: this.resolvers.resolvers }),
      context: ({ request }) => this.contexts.create(request),
      graphqlEndpoint: '/graphql',
      graphiql: options.graphiql ?? false,
      // DemoAuth also serves REST login routes before Yoga routing, so its
      // response hook applies one consistent CORS policy to all API responses.
      cors: false,
      logging:
        options.logging === false || this.config.values.LOG_LEVEL === 'silent'
          ? false
          : this.config.values.LOG_LEVEL === 'debug'
            ? 'debug'
            : 'info',
    });
  }
}
