# Plan: Su Ky Agent Demo Skeleton

## Objectives
Build a monorepo skeleton proving the full stack runs together stably with zero Docker, zero Redis, and zero Postgres server:
**Bun 1.4 + Turborepo + Next.js + Hono + Pi SDK + OpenCode Go + Zod + PGlite + pg-boss + Drizzle ORM**.

## Architecture & Constraints
- Monorepo managed by Turborepo and Bun workspaces.
- Single runtime owner for PGlite: ONLY `apps/api` runs PGlite and pg-boss. Next.js (`apps/web`) NEVER imports `@repo/db`.
- Shared package `@repo/contracts` defines all cross-boundary Zod schemas and TypeScript types.
- Shared package `@repo/db` defines Drizzle schemas, PGlite client singleton, and programmatic migrations.
- `apps/api`: Native Bun Hono server on port 3001. Strict startup lifecycle:
  1. Validate env
  2. Init PGlite singleton
  3. Init Drizzle
  4. Run Drizzle migrations
  5. Init pg-boss with `fromPglite(pglite)`
  6. Register queues (`demo-ping`)
  7. Register workers (`demo-ping` writes to `system_events`)
  8. Init Pi model runtime
  9. Start Hono server
  - Clean shutdown on SIGINT/SIGTERM with connection draining and safe teardown.
- `apps/web`: Next.js App Router on port 3000. Shows stack status board and interactive test buttons for Queue and Pi SDK.
- Zero external daemon dependencies.
- Repository convention: No tests (`AGENTS.md`).

## Phases
- [x] Phase 1: Initialize Turborepo & Workspace Configuration (root `package.json`, `turbo.json`, `tsconfig.json`, `.gitignore`, `.env.example`)
- [x] Phase 2: Create `@repo/contracts` with Zod Schemas (`HealthResponseSchema`, `QueueTestResponseSchema`, `PiTestResponseSchema`)
- [x] Phase 3: Create `@repo/db` with PGlite, Drizzle ORM, `system_events` table, and migrations
- [x] Phase 4: Create `apps/api` with Hono, pg-boss integration, Pi SDK service, routes, and graceful shutdown
- [x] Phase 5: Create `apps/web` with Next.js status dashboard and API test actions
- [x] Phase 6: Verification, Documentation, and Finalize
