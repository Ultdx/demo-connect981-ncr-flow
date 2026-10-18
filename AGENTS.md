# Project conventions

- Keep code comments and project documentation in English.
- Prefer classes for application services and reusable behavior. React components and hooks keep their functional form so their existing hook lifecycle remains idiomatic.
- Keep the recommended React Hooks lint rules enabled. Memoize query variables with their complete dependencies; query effects must cancel obsolete requests and ignore late results after cleanup.
- Compose API dependencies through `src/container.ts` with InversifyJS and constructor injection. Keep container access at entry points; application services must not resolve their own dependencies. MongoDB connections and compiled models belong to their application container.
- Keep each API model/subdocument class in its own file. Preserve collection names, indexes, and validation when reorganizing models.
- Prefer direct, readable code. Extract a helper only when it enforces shared behavior or preserves a necessary architectural boundary. Keep one-off MongoDB queries inline; do not add convenience wrappers around a single call.
- Use precise TypeScript types for inputs, outputs, persisted payloads, and component contracts. Keep strict compiler checks enabled. Inference is appropriate when it preserves the exact type.
- Do not use `any`. Use `unknown` only for genuinely untrusted inputs or caught JavaScript errors; explain the boundary and validate or narrow the value immediately. Never use a double assertion to bypass a type mismatch.
- Keep generated GraphQL types generated: fix schemas, mappings, or generator settings rather than editing generated files by hand.
