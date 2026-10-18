import 'reflect-metadata';
import { Container } from 'inversify';
import { ApiConfig } from './config.js';
import { Database } from './db.js';
import { ModelRegistry } from './models/ModelRegistry.js';
import { ErpAdapter } from './erp/ErpAdapter.js';
import { WorkflowGates } from './workflow/gates.js';
import { WorkflowEngine } from './workflow/engine.js';
import { AuditReplay } from './workflow/replay.js';
import { NcrCommands } from './services/commands.js';
import { ContextFactory } from './context.js';
import { ApiResolvers } from './resolvers/index.js';
import { SeedService } from '../seed/data.js';
import { ApiApplication } from './app.js';
import { ApiServer } from './httpServer.js';
import { DemoAuth } from './auth/DemoAuth.js';

/** The only service composition root, shared by server, seed, demo and tests. */
export class ApiContainer extends Container {
  constructor(config: ApiConfig = new ApiConfig()) {
    super({ defaultScope: 'Singleton' });
    this.bind(ApiConfig).toConstantValue(config);
    this.bind(Database).toResolvedValue(
      (settings: ApiConfig) => new Database(settings),
      [ApiConfig],
    );
    this.bind(ErpAdapter).toSelf();
    this.bind(WorkflowGates).toSelf();
    this.bind(AuditReplay).toSelf();
    this.bind(DemoAuth).toResolvedValue(
      (settings: ApiConfig) => new DemoAuth(settings),
      [ApiConfig],
    );
    // Explicit constructor dependencies work in both tsc and tsx/Vitest, which
    // do not emit TypeScript decorator metadata. No container reaches services.
    this.bind(ModelRegistry).toResolvedValue(
      (database: Database) => new ModelRegistry(database),
      [Database],
    );
    this.bind(WorkflowEngine).toResolvedValue(
      (gates: WorkflowGates) => new WorkflowEngine(gates),
      [WorkflowGates],
    );
    this.bind(NcrCommands).toResolvedValue(
      (database: Database, models: ModelRegistry, erp: ErpAdapter, engine: WorkflowEngine) =>
        new NcrCommands(database, models, erp, engine),
      [Database, ModelRegistry, ErpAdapter, WorkflowEngine],
    );
    this.bind(ContextFactory).toResolvedValue(
      (models: ModelRegistry, auth: DemoAuth) => new ContextFactory(models, auth),
      [ModelRegistry, DemoAuth],
    );
    this.bind(ApiResolvers).toResolvedValue(
      (
        models: ModelRegistry,
        settings: ApiConfig,
        erp: ErpAdapter,
        commands: NcrCommands,
        engine: WorkflowEngine,
      ) => new ApiResolvers(models, settings, erp, commands, engine),
      [ModelRegistry, ApiConfig, ErpAdapter, NcrCommands, WorkflowEngine],
    );
    this.bind(SeedService).toResolvedValue(
      (database: Database, models: ModelRegistry, engine: WorkflowEngine) =>
        new SeedService(database, models, engine),
      [Database, ModelRegistry, WorkflowEngine],
    );
    this.bind(ApiApplication).toResolvedValue(
      (
        database: Database,
        models: ModelRegistry,
        seed: SeedService,
        contexts: ContextFactory,
        resolvers: ApiResolvers,
        settings: ApiConfig,
        auth: DemoAuth,
      ) => new ApiApplication(database, models, seed, contexts, resolvers, settings, auth),
      [Database, ModelRegistry, SeedService, ContextFactory, ApiResolvers, ApiConfig, DemoAuth],
    );
    this.bind(ApiServer).toResolvedValue(
      (application: ApiApplication, database: Database, settings: ApiConfig) =>
        new ApiServer(application, database, settings),
      [ApiApplication, Database, ApiConfig],
    );
  }
}
