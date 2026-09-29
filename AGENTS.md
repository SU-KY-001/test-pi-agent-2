# Repository Conventions

## Testing Policy
- **No Tests**: Dự án này không dùng và không chạy test (unit tests, integration tests, end-to-end tests đều không cần thiết). Không tạo test files hay scripts test.

## Tech Stack & Architecture
- **Runtime & Package Manager**: Bun 1.4+ (strictly Bun, không dùng npm/pnpm/yarn).
- **Monorepo**: Turborepo.
  - `apps/web`: Next.js 15 (App Router, React 19).
  - `apps/api`: Hono native trên Bun.
  - `packages/contracts`: Zod schemas & shared types.
  - `packages/db`: PGlite embedded database & Drizzle ORM.
- **Embedded Database & Queue**:
  - PGlite embedded trong `packages/db`.
  - Duy nhất `apps/api` là runtime owner của PGlite. `apps/web` không bao giờ import `@repo/db`.
  - pg-boss chạy trực tiếp trên backend PGlite (`fromPglite`).
  - Zero external daemons: Không Docker, không Redis, không Postgres server.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
