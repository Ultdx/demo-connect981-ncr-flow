# NCR Flow

NCR Flow is a manufacturing quality demo for reporting non-conformances, resolving them through a guided workflow, and tracing affected material across two sites. The stack combines **TypeScript, React + Vite, Node.js + GraphQL Yoga, InversifyJS, MongoDB + Typegoose/Mongoose, Zod, GraphQL Code Generator, and Vitest**.

## Run locally without Docker

Requires **Node.js 22.15+ within Node 22** and **npm 10.9.3+**. From the repository root:

```sh
npm ci
cp .env.example .env
```

Set `DEMO_USERNAME` and `DEMO_PASSWORD` in the private `.env`, then run:

```sh
npm run demo
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) and sign in with your configured account. The command starts the frontend, API, and a temporary MongoDB replica set with fictional demo data; no MongoDB installation is needed. The first launch downloads MongoDB **7.0.24**; alternatively, set `MONGOMS_SYSTEM_BINARY` to a local executable.

Ports **4000** and **5173** must be free. Stop with **Ctrl+C** or type `stop`; restarting restores the initial data. GraphiQL is available at [http://127.0.0.1:4000/graphql](http://127.0.0.1:4000/graphql) after sign-in.

## Run with Docker

Requires **Docker Compose v2** and Linux containers. Create `.env` as above, set the account, and set `DOCKER_MONGO_URI` for the internal MongoDB service: host `mongo`, port `27017`, database `ncrflow`, replica set `rs0`.

```sh
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). Compose initializes the database automatically; ports **8080** and **27017** must be free. `docker compose down` preserves data; add `--volumes` to discard it and reset the next launch.

## Architecture and demo scope

- **API:** class-based services wired through InversifyJS constructor injection. Each application container owns its MongoDB connection and Typegoose models.
- **Contracts:** generated GraphQL types, Zod input validation, and request-scoped DataLoaders for related production data.
- **Workflow:** versioned definitions, role checks, transactional commands, optimistic concurrency, and an append-only audit trail recording user and role. The UI groups the process into five phases.
- **React:** functional components and hooks, typed forms, and cancellable queries that ignore obsolete responses.
- **Demo boundaries:** a shared account with an eight-hour `HttpOnly` cookie session stored in one API process; the role selector simulates business responsibilities. Containment requires documented isolation, with a digital hold for critical NCRs. Closing an NCR keeps its hold; hold release and Quality rejection/reopening are outside this short scenario.

Start with `NCR-2026-001` and follow `LOT-EL-2291` across Lyon and Montreal. Switch to the suggested roles to progress through Containment, Decision, Execution, and Verification, then inspect the audit trail.

## Checks

```sh
npm run check
npm run test:integration
```

These cover generated types, TypeScript, lint, formatting, unit/component tests, builds, and transactional integration tests against temporary MongoDB. Docker is not required.

## Hosting

The API can run under **PM2**, behind an **nginx HTTPS reverse proxy with Certbot**. Generic configuration examples are in `deployment/`. Set the frontend API URL in the ignored `apps/web/.env.production.local` before building. Private environment files and keys stay outside Git; templates contain no credentials.

All rights reserved; see [LICENSE](LICENSE). Third-party branding and the OFL-licensed Inter font retain their own terms: [asset credits](apps/web/public/brand/README.md).
