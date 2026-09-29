# Repository Guidelines

## Project Overview
Su Ky Agent Demo is a local-first, zero-external-daemon AI agent skeleton. It proves that an entire multi-tier stack (**Next.js + Hono + Pi SDK + OpenCode Go + Zod + PGlite + pg-boss + Drizzle ORM**) runs stably and cohesively within a Turborepo monorepo managed exclusively with **Bun 1.4+**, requiring zero Docker, Redis, or external PostgreSQL daemons.

---

## Architecture & Data Flow
```
Browser / Client (localhost:3000)
       │
       ▼
apps/web (Next.js 15 App Router)
       │ HTTP fetch (validated with @repo/contracts Zod schemas)
       ▼
apps/api (Hono native on Bun, localhost:3001) ── [Single Runtime Owner]
       ├── Drizzle ORM (@repo/db) ──────┐
       ├── pg-boss (fromPglite) ────────┼──▶ PGlite (Embedded DB: ./packages/db/data/pgdata)
       └── Pi SDK (ephemeral session) ──┴──▶ OpenCode Go Provider
```

### Key Architectural Constraints
1. **Single Runtime Owner for Database**:
   - `apps/api` is the **sole runtime owner** of PGlite and pg-boss.
   - `apps/web` **MUST NEVER** import `@repo/db` or access `./packages/db/data/pgdata` directly. Web communicates exclusively via HTTP to `apps/api`.
2. **Zero External Daemons**:
   - Do NOT introduce Docker, Redis, PostgreSQL server, or Trigger.dev.
   - Background tasks run via `pg-boss` wired directly to embedded PGlite using `fromPglite(pglite)`.
3. **Safe Pi SDK Execution**:
   - Keep Pi sessions ephemeral. Initialize via `createAgentSession` with `SessionManager.inMemory()` and `tools: []` (empty tools for smoke probing; no filesystem/bash/MCP access).
   - Always invoke `await session.dispose()` in a `finally` block to release process memory.

---

## Key Directories

| Directory | Role & Responsibilities |
| :--- | :--- |
| `apps/api` | Backend service: Hono on Bun, owns PGlite runtime, pg-boss queue, Pi SDK service, REST routes. |
| `apps/web` | Frontend application: Next.js 15 (React 19), status dashboard, client API wrapper (`lib/api.ts`). |
| `packages/contracts` | Shared contract package: Single source of truth for cross-boundary Zod validation schemas and TypeScript types. |
| `packages/db` | Shared database package: Drizzle ORM schema, PGlite client singleton, and programmatic migrator (`runMigrations`). |
| `packages/db/data/pgdata` | Local filesystem storage for embedded PGlite database (gitignored except `.gitkeep`). |

---

## Development Commands

All commands MUST be run with `bun`. Do not use `npm`, `pnpm`, or `yarn`.

### Monorepo Root Commands
```bash
bun run dev          # Start both Web (:3000) and API (:3001) concurrently via Turborepo
bun run build        # Build all packages and apps topologically via Turborepo
bun run typecheck    # Typecheck all packages with tsc --noEmit across workspaces
```

### Workspace Commands
```bash
# Backend API (apps/api)
bun --cwd apps/api dev            # Run Hono API with hot reload (bun run --hot src/index.ts)
bun --cwd apps/api typecheck      # Typecheck API codebase

# Frontend Web (apps/web)
bun --cwd apps/web dev            # Run Next.js dev server on port 3000
bun --cwd apps/web build          # Build Next.js production bundle

# Database (packages/db)
bun --cwd packages/db db:generate # Generate Drizzle migration SQL files into packages/db/drizzle
```

---

## Code Conventions & Common Patterns

### 1. Sequential API Startup Lifecycle
`apps/api/src/index.ts` enforces a deterministic 9-step boot order. If any critical database or queue step fails, the API must fail-fast (`process.exit(1)`):
```text
1. Validate env (apps/api/src/config/env.ts)
2. Initialize PGlite singleton (packages/db/src/client.ts)
3. Connect Drizzle ORM (packages/db/src/drizzle.ts)
4. Run database migrations programmatically (packages/db/src/migrate.ts)
5. Initialize pg-boss queue using fromPglite(pglite) (apps/api/src/queue/boss.ts)
6. Verify and create queues ('demo-ping')
7. Register queue workers (apps/api/src/queue/workers.ts)
8. Initialize Pi model runtime (apps/api/src/pi/pi.service.ts)
9. Start Hono server listener on port 3001
```

### 2. Graceful Shutdown & Connection Draining
The API handles `SIGINT` and `SIGTERM` gracefully:
```ts
server.stop(false); // Stop accepting new connections (returns 503 for pending)
// Drain active in-flight requests with a 3-second deadline
const drainDeadline = Date.now() + 3000;
while (activeRequests > 0 && Date.now() < drainDeadline) {
  await Bun.sleep(50);
}
if (activeRequests > 0) server.stop(true); // Force termination if deadline expired
await stopBoss();     // Stop pg-boss workers and timers
await closePglite();  // Close PGlite database cleanly
process.exit(0);
```

### 3. Shared Contracts Pattern
Every cross-boundary request/response MUST define a Zod schema in `packages/contracts/src`:
```ts
// packages/contracts/src/health.ts
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  services: z.object({
    api: z.boolean(),
    database: z.boolean(),
    queue: z.boolean(),
    pi: z.boolean(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```
- API route validates outgoing payloads with `.parse()`.
- Web client validates incoming JSON with `schema.safeParse()`.

### 4. Database Single Client & Programmatic Migration
- Do NOT run `drizzle-kit push` at runtime.
- Use `runMigrations()` from `packages/db/src/migrate.ts` utilizing `drizzle-orm/pglite/migrator` against `./packages/db/drizzle`.

---

## Important Files

- `apps/api/src/index.ts`: Application entry point, server startup lifecycle, request draining, and shutdown hooks.
- `apps/api/src/config/env.ts`: Zod schema for environment variables; maps `PI_MODEL` and `OPENCODE_MODEL`.
- `apps/api/src/pi/pi.service.ts`: Singleton service wrapping `@earendil-works/pi-coding-agent`.
- `apps/api/src/queue/boss.ts`: `pg-boss` lifecycle using `fromPglite(pglite)`.
- `apps/api/src/queue/workers.ts`: Background workers consuming jobs and updating `system_events`.
- `packages/db/src/client.ts`: Singleton PGlite client instance with repo-root path resolution.
- `packages/contracts/src/index.ts`: Public API export for shared Zod contracts.
- `apps/web/lib/api.ts`: Typed fetch wrapper communicating with `apps/api`.
- `turbo.json`: Turborepo pipeline tasks (`dev`, `build`, `typecheck`).
- `.env.example`: Template for environment variables.

---

## Runtime & Tooling Preferences

- **Runtime**: Strictly **Bun 1.4+** (`bun@1.4.0` in `packageManager`).
- **Package Manager**: Use `bun add`, `bun install`, `bun run`. Never use `npm`, `yarn`, or `pnpm`.
- **Monorepo Engine**: Turborepo 2.x.
- **TypeScript**: Strict typechecking (`tsc --noEmit`). No `any` types; all workspace dependencies linked via `"workspace:*"`.
- **Database & Queue**: Embedded PGlite + pg-boss. No external service containers.

---

## Testing & QA

### Testing Policy: No Tests
- **No Test Frameworks**: This project strictly does NOT maintain or run automated unit, integration, or E2E test suites (`bun:test`, Jest, Vitest, Playwright, etc.).
- **Do Not Create Tests**: Agents MUST NOT create `*.test.ts`, `*.spec.ts`, or test fixtures unless explicitly requested by the user.

### Verification & QA Strategy
Verification is performed via static analysis, runtime contracts, and active subsystem probes:
1. **Type Safety**: Run `bun run typecheck` across all 4 packages.
2. **Build Integrity**: Run `bun run build` ensuring Next.js and TypeScript packages build without error.
3. **Endpoint Probes**:
   - `GET /health`: Actively verifies Hono, executes `SELECT 1` on PGlite, checks `pg-boss` queue readiness, and confirms Pi model configuration.
   - `POST /queue/test`: Submits a job to `demo-ping`, verifies worker consumption, and confirms audit log write in `system_events`.
   - `POST /pi/test`: Instantiates an ephemeral Pi agent session and invokes the configured OpenCode Go LLM.
4. **Interactive Dashboard**: Manual verification via `localhost:3000` buttons.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
