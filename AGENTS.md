# Repository Guidelines

## Project Overview
Su Ky Agent Demo is a local-first, zero-external-daemon AI agent system. It proves that a multi-tier stack (**Next.js + Hono + Pi SDK + OpenCode Go + Zod + PGlite + pg-boss + Drizzle ORM**) runs stably within a Turborepo monorepo managed exclusively with **Bun 1.4+**, with zero Docker, Redis, or external PostgreSQL daemons. Current product: a 4-agent advertisement pipeline (Extractor → Planner → Writer → Reviewer) with a human-in-the-loop gate on the plan.

---

## Architecture & Data Flow
```
Browser / Client (localhost:3000)
       │
       ▼
apps/web (Next.js 15 App Router: page.tsx + TracePanel, lib/workflow-api.ts)
       │ HTTP fetch (validated with @repo/contracts Zod schemas)
       ▼
apps/api (Hono native on Bun, localhost:3001) ── [Single Runtime Owner]
       ├── Drizzle ORM (@repo/db) ──────┐
       ├── pg-boss (fromPglite) ────────┼──▶ PGlite (Embedded DB: ./packages/db/data/pgdata)
       └── Pi SDK (ephemeral session) ──┴──▶ OpenCode Go Provider
              │
              ▼
  extractor → planner → [HITL approve/regenerate] → writer → reviewer
```

### Key Architectural Constraints
1. **Single Runtime Owner for Database**:
   - `apps/api` is the **sole runtime owner** of PGlite and pg-boss.
   - `apps/web` **MUST NEVER** import `@repo/db` or access `./packages/db/data/pgdata` directly. Web communicates exclusively via HTTP to `apps/api`.
2. **Zero External Daemons**:
   - Do NOT introduce Docker, Redis, PostgreSQL server, or Trigger.dev.
   - Background tasks run via `pg-boss` wired directly to embedded PGlite using `fromPglite(pglite)`.
3. **Safe Pi SDK Execution**:
   - Keep Pi sessions ephemeral. `createAgentSession` with `SessionManager.inMemory()` and `tools: []` (no filesystem/bash/MCP).
   - Always `await session.dispose()` in a `finally` block.
   - `agent-runner.ts` currently hardcodes provider `"opencode-go"` in `getModel`; do not add a second provider string — fix by reusing `env.PI_PROVIDER`.

---

## Key Directories

| Directory | Role & Responsibilities |
| :--- | :--- |
| `apps/api/src` | Hono on Bun. `index.ts` boot/drain, `config/` env+logger, `pi/` runtime+tracer, `agents/` runner+4 agents+prompts, `queue/` boss+workers+jobs, `workflow/` types/service/repository, `routes/` health/queue/pi/workflow/events. |
| `apps/web` | Next.js 15 (React 19) dashboard. `app/page.tsx` create/poll/HITL/ad-card, `components/trace-panel.tsx` SSE timeline, `lib/api.ts` + `lib/workflow-api.ts` fetch clients. |
| `packages/contracts/src` | Single source of truth: `health/queue/pi` + `workflow/{api, product-data, content-plan, advertisement, review-result, events}`. |
| `packages/db/src` | `client.ts` PGlite singleton, `drizzle.ts`, `migrate.ts`, `schema/{workflow-runs, workflow-steps, step-versions, system-events}.ts`. |
| `packages/db/drizzle` | `0000` system_events, `0001` workflow tables + FKs. |
| `packages/db/data/pgdata` | Embedded DB storage (gitignored except `.gitkeep`; ignore `postmaster.pid`/WAL locally). |

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
`apps/api/src/index.ts` enforces a deterministic 9-step boot order. Migrate/boss/workers failure is fail-fast (`process.exit(1)`); Pi init is non-fatal so `/health` can report `pi: false`:
```text
1. Validate env (apps/api/src/config/env.ts → RESOLVED_MODEL = PI_MODEL || OPENCODE_MODEL || "minimax-m3")
2. Initialize PGlite singleton (packages/db/src/client.ts)
3. Connect Drizzle ORM (packages/db/src/drizzle.ts)
4. Run database migrations programmatically (packages/db/src/migrate.ts)
5. Initialize pg-boss queue using fromPglite(pglite) (apps/api/src/queue/boss.ts)
6. Verify and create 5 queues ('demo-ping' + 4 WORKFLOW_QUEUES)
7. Register queue workers (apps/api/src/queue/workers.ts, payload guard numeric workflowRunId)
8. Initialize Pi model runtime (apps/api/src/pi/pi.service.ts, ModelRuntime.create refreshOnCreate:false)
9. Start Hono server listener on port 3001 (Bun.serve, x-request-id, 503 while draining)
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
- Workflow schemas live in `packages/contracts/src/workflow/` (api, product-data, content-plan, advertisement, review-result, events). Status enums are Zod-only; DB status columns are plain `text`.

### 4. Database Single Client & Programmatic Migration
- Do NOT run `drizzle-kit push` at runtime.
- Use `runMigrations()` from `packages/db/src/migrate.ts` utilizing `drizzle-orm/pglite/migrator` against `./packages/db/drizzle`.

### 5. Workflow Job Pattern (do not invent a new shape)
`apps/api/src/queue/jobs/*.job.ts` all follow: set RUNNING + log event → load previous output (`loadLatestStepOutput` / `loadApprovedPlannerOutput` for writer gate) → `runStructuredAgent` → `insertStepVersion` append-only (initial v1, regenerate `(current ?? 0) + 1`) → set WAITING_FOR_HUMAN or enqueue next. `AgentValidationError` or missing/not-found → FAILED terminal without rethrow. Other errors → FAILED + rethrow for pg-boss retry (max 3). `saveNextStepVersion` in workflow.service is currently unused — jobs insert directly; do not duplicate version-bump logic further.
- Agent runner: `runStructuredAgent` in `apps/api/src/agents/agent-runner.ts` — ephemeral session, JSON fence extraction, 1 schema retry via `buildSchemaRetryPrompt`, tracer attach before prompt, flush/detach/dispose in `finally`.
- Tracer: `apps/api/src/pi/pi.tracer.ts` — persist only lifecycle events, drop streaming, 4KB metadata cap.
- SSE: `GET /events/stream` polls DB 1s/client with 15s heartbeat; `GET /events` caps `limit ≤ 200`.

---

## Important Files

- `apps/api/src/index.ts`: boot lifecycle, request draining, shutdown hooks, route mounts.
- `apps/api/src/config/env.ts`: Zod env; `RESOLVED_MODEL`, `PI_THINKING_LEVEL`.
- `apps/api/src/pi/pi.service.ts`: ModelRuntime singleton, `isReady`, ephemeral `testSmoke`.
- `apps/api/src/pi/pi.tracer.ts`: session events → pino + `system_events`.
- `apps/api/src/agents/agent-runner.ts`: structured agent helper (noTools, JSON extract, 1 retry).
- `apps/api/src/queue/boss.ts`: pg-boss singleton, 5 queues.
- `apps/api/src/queue/workers.ts`: `demo-ping` + 4 agent workers with payload guard.
- `apps/api/src/workflow/workflow.types.ts`: queue names, statuses, `AgentJobPayload`, retry count.
- `apps/api/src/workflow/workflow.service.ts`: `loadApprovedPlannerOutput` (writer gate), `loadLatestStepOutput`.
- `apps/api/src/workflow/workflow.repository.ts`: Drizzle CRUD for runs/steps/versions/events.
- `packages/db/src/client.ts`: PGlite singleton with repo-root path resolution.
- `packages/contracts/src/index.ts` + `workflow/`: public Zod boundary.
- `apps/web/app/page.tsx`, `lib/workflow-api.ts`, `lib/api.ts`, `components/trace-panel.tsx`: dashboard + typed fetch + SSE.
- `turbo.json`: Turborepo pipeline (`dev`, `build`, `typecheck`).
- `.env.example`: env template (`PI_MODEL` wins over `OPENCODE_MODEL`).

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
1. **Type Safety**: Run `bun run typecheck` across all workspaces.
2. **Build Integrity**: Run `bun run build` ensuring Next.js and TypeScript packages build without error.
3. **Endpoint Probes**:
   - `GET /health`: `SELECT 1` on PGlite, `demo-ping` queue check, Pi ready flag.
   - `POST /queue/test`: submits `demo-ping`, worker writes `system_events`.
   - `POST /pi/test`: ephemeral Pi session (PONG); 503 when model/key not ready.
   - `POST /workflows` → `GET /workflows/:id` → planner approve/regenerate → writer/reviewer → `COMPLETED`; `GET /events` + SSE stream for trace.
4. **Interactive Dashboard**: Manual verification via `localhost:3000` (create, version tabs, feedback, approve, TracePanel).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
