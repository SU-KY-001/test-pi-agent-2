# Plan: Su Ky Agent Demo

## Objectives
Prove a full local-first stack runs stably with zero Docker, zero Redis, zero Postgres server:
**Bun 1.4 + Turborepo + Next.js + Hono + Pi SDK + OpenCode Go + Zod + PGlite + pg-boss + Drizzle ORM**.
Product on top: 4-agent ad pipeline (Extractor → Planner → Writer → Reviewer) with HITL gate on the plan, SSE trace, dark dashboard.

## Architecture & Constraints
- Turborepo + Bun workspaces.
- Single runtime owner: ONLY `apps/api` runs PGlite and pg-boss. `apps/web` NEVER imports `@repo/db`.
- `@repo/contracts` owns all cross-boundary Zod schemas; `@repo/db` owns Drizzle schema + PGlite singleton + programmatic migrations.
- `apps/api` (Bun Hono :3001) strict boot:
  1. Validate env (`RESOLVED_MODEL = PI_MODEL || OPENCODE_MODEL || "minimax-m3"`)
  2. Init PGlite singleton
  3. Init Drizzle
  4. Run migrations
  5. Init pg-boss with `fromPglite(pglite)`
  6. Create 5 queues (`demo-ping` + 4 `agent.*`)
  7. Register workers (numeric `workflowRunId` guard)
  8. Init Pi runtime (non-fatal)
  9. Start Hono server
  - Shutdown: stop(false) → drain 3s → stop(true) → stopBoss → closePglite.
- Workflow rules: append-only `step_versions`, planner-only HITL (`WAITING_FOR_HUMAN`), writer requires approved plan, terminal FAILED on validation/missing else retry x3, ephemeral Pi sessions `tools: []` + dispose.
- `apps/web` (:3000): create → poll 1.5s → HITL version tabs + regenerate/approve → ad + verdict → SSE TracePanel.
- Zero external daemons. No tests per `AGENTS.md`; verify via typecheck/build/probes/dashboard.

## Phases
- [x] Phase 1: Turborepo & workspace config (root package, turbo, tsconfig, gitignore, .env.example)
- [x] Phase 2: `@repo/contracts` (health, queue, pi)
- [x] Phase 3: `@repo/db` (PGlite, Drizzle, system_events, migrations)
- [x] Phase 4: `apps/api` skeleton (Hono, boss, Pi service, health/queue/pi routes, shutdown)
- [x] Phase 5: `apps/web` skeleton (status board + queue/pi test buttons)
- [x] Phase 6: Skeleton verification + docs
- [x] Phase 7: 4-agent workflow (contracts/workflow, db workflow_runs/steps/versions, agents + runner + tracer, jobs + workers, workflow service/repo, workflow + events routes with HITL)
- [x] Phase 8: Dashboard v2 (shadcn dark mode, HITL card, SSE trace timeline, thinking config, strict patch types, OPENCODE_MODEL alias)

## Next (proposed, not started)
- [x] Fix `agent-runner` hardcoded `"opencode-go"` → use `env.PI_PROVIDER`.
- [ ] Remove or reuse dead `saveNextStepVersion` (jobs insert directly today).
- [ ] Confirm `GET /workflows/:id` version order (currently newest-first) vs UI tabs expectation.
- [ ] Add DB check constraints for status enums if Zod drift becomes a risk.
- [ ] Reduce SSE DB polling (1s/client) when many clients.
