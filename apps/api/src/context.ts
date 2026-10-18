import type { Role } from './workflow/types.js';
import { RequestLoaders } from './loaders.js';
import { ModelRegistry } from './models/ModelRegistry.js';
import { InputValidation, roleSchema } from './validation/inputs.js';
import { DemoAuth } from './auth/DemoAuth.js';

export interface Context {
  username: string;
  role: Role;
  loaders: RequestLoaders;
}
export interface ContainSiteCountRow {
  siteId: string;
  workOrders: number;
  serials: number;
}

export class ContextFactory {
  constructor(
    private readonly models: ModelRegistry,
    private readonly auth: DemoAuth,
  ) {}

  create(request: Request): Context {
    return {
      username: this.auth.requireUser(request),
      // This header selects a demo persona, not authentication. Invalid roles fail closed.
      role: InputValidation.parse(roleSchema, request.headers.get('x-role') ?? 'INSPECTOR'),
      // Each HTTP request owns its caches; singleton services cannot leak them.
      loaders: new RequestLoaders(this.models),
    };
  }
}
