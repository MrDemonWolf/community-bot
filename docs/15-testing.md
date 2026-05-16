# 15 — Testing strategy

## Layers

1. **Unit tests** — pure functions, template engine, permissions, crypto. Vitest.
2. **Integration tests** — against a real Postgres (Testcontainers via Bun). Includes pgmq + pg_cron migrations.
3. **Contract tests** — mock Twitch Helix + Discord API via MSW. Verify schemas don't break.
4. **E2E tests** — Playwright for `/setup` flow + critical dashboard paths.
5. **Manual smoke** — `docs/smoke-test.md` checklist after each phase.

## Coverage targets

- `packages/shared` template engine: 95%+
- `packages/shared` permissions: 100%
- `packages/shared` crypto: 100%
- `packages/db` schemas: don't test the ORM; do test migrations apply cleanly
- `apps/server` tRPC procedures: 80% (happy path + auth + invalid)
- `apps/twitch` command dispatch: 80%
- `apps/discord` slash dispatch: 70%

## Critical test cases (must exist before Phase 1 merges to main)

- `permissions.test.ts`: every role × every action
- `template.test.ts`: every variable resolver
- `crypto.test.ts`: encrypt → decrypt round-trip + tampered ciphertext fails
- `audit-immutable.test.ts`: UPDATE / DELETE on `audit_logs` raises
- `one-broadcaster.test.ts`: cannot insert second broadcaster

## Phase 5B sandbox tests

- Time limit: a 5-second loop is killed at 200ms
- Memory limit: allocating 17MB array throws
- Host API surface: only whitelisted methods callable
- No `eval`, no `Function` constructor, no `import`
- Output capture: `console.log` captured, not leaked to process stdout

## Phase 8 AI tests

- Cost cap: if spend + estimate > budget → don't call
- Guardrail: forbidden categories blocked
- Consent: AI targeting opted-out user → blocked
- JSON schema: malformed output → retry once, then fail with audit

## CI matrix

GitHub Actions on every PR:

- `bun --filter='*' typecheck` (parallel)
- `bun --filter='*' lint`
- `bun --filter='*' test`
- `bun --filter='*' build` (parallel)
- `cd packages/db && bun run migrate:dry-run`
- `cd apps/web && bunx playwright test --reporter=github` (Phase 1+)

Concurrency group per branch. Cancel in-flight on new push.
