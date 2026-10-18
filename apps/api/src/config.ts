import { z } from 'zod';

const frontendOrigin = z
  .url({ protocol: /^https?$/ })
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  }, 'Use only the frontend origin, without a path, query, or credentials.')
  .transform((value) => new URL(value).origin);

// Configuration is validated by the composition root before opening a port.
const environment = z.object({
  // Demo account secrets are runtime-only. Never provide a checked-in fallback.
  DEMO_USERNAME: z.string().trim().min(1, 'Set DEMO_USERNAME in the API environment.').max(80),
  DEMO_PASSWORD: z
    .string()
    .min(1, 'Set DEMO_PASSWORD in the API environment.')
    .max(128)
    .refine((value) => value.trim().length > 0, 'DEMO_PASSWORD cannot be blank.'),
  MONGO_IN_MEMORY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MONGO_URI: z.string().trim().default(''),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  SEED_ON_START: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  STALE_NCR_DAYS: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z.enum(['silent', 'info', 'debug']).default('info'),
  GRAPHIQL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AUTH_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  FRONTEND_ORIGIN: z.literal('').or(frontendOrigin).default(''),
});

export class ApiConfig {
  readonly values: z.infer<typeof environment>;

  constructor(values: Record<string, string | undefined> = process.env) {
    this.values = environment.parse(values);
  }
}
