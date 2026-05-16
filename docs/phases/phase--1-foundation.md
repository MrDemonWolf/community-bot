# Phase -1 — Foundation hardening

**Status legend:** 🔴 not started · 🟡 in progress · 🟢 done · ⏸ blocked

**Goal:** Take the freshly-scaffolded better-t-stack repo and turn it into a production-ready foundation BEFORE we ship any user-facing features. No bot code yet. No dashboard yet. Just bones.

**Why this phase exists:** Skipping foundation work is the #1 reason side-projects collapse at month 3. We do it now while there's nothing to migrate.

---

## Scope — IN

- [ ] Bun-only enforced repo-wide (engines, packageManager, .npmrc, bunfig.toml, only-allow preinstall)
- [ ] TypeScript strict mode in every package (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
- [ ] ESLint + Prettier configured (Turborepo-aware)
- [ ] Husky + lint-staged on pre-commit (typecheck, lint, format only changed files)
- [ ] Commit message linting via commitlint (Conventional Commits)
- [ ] Pino logger package at `packages/logger` with redaction config
- [ ] Shared types package at `packages/shared` with role enum, error classes, common Zod schemas
- [ ] Drizzle migrations infra: `bun db:generate`, `bun db:migrate`, `bun db:studio`
- [ ] Supabase local dev via `supabase/` directory and `supabase start`
- [ ] Initial schema with `userMeta` + `auditLogs` + `apiKeys` + `kvEncrypted` tables
- [ ] Audit log append-only trigger (ADR-006) implemented and tested
- [ ] Field-level encryption helper at `packages/shared/src/crypto/encrypt.ts` with key versioning
- [ ] Better-Auth wired into Hono server with Twitch OAuth provider configured
- [ ] tRPC router skeleton with role-based middleware (`broadcasterOnly`, `modOrAbove`, `authenticated`)
- [ ] Solo Main Protection ruleset applied via `gh-solo-main-protection` skill
- [ ] CI workflow: typecheck, lint, test, build (matrix: bun-latest on ubuntu-latest)
- [ ] CI requires: green on PR to develop and main
- [ ] CODEOWNERS file pointing to broadcaster
- [ ] Issue templates: bug, feature, security
- [ ] Pull request template with checklist
- [ ] `.env.example` covering every variable that will exist by Phase 9
- [ ] Dependabot config for weekly updates with auto-merge for patches only

## Scope — OUT (do NOT do in this phase)

- ❌ Any bot code (Discord or Twitch)
- ❌ Any dashboard UI beyond Better-Auth login redirect
- ❌ Any business logic (commands, timers, flows)
- ❌ Deployment to Dokploy (Phase 9 cuts deploy in earnest)

---

## Acceptance criteria

1. `bun install` from clean clone produces zero warnings
2. `bun typecheck` passes across all packages
3. `bun lint` passes
4. `bun test` passes (even if test suite is small — Phase -1 only needs to prove infra works)
5. `bun db:migrate` applies cleanly to a fresh Supabase instance
6. Audit log trigger test: attempting `UPDATE audit_logs` raises; `INSERT` succeeds; `SELECT` succeeds
7. Encryption helper round-trips a string with both v1 and v2 keys (key versioning works)
8. PR to develop triggers CI; CI green required to merge
9. Direct push to main is blocked by branch ruleset

---

## Test plan

```bash
# 1. Clone fresh, install
git clone <repo> tmp-clone && cd tmp-clone
bun install

# 2. Verify Bun-only enforcement
npm install  # MUST FAIL with only-allow message

# 3. Typecheck + lint
bun typecheck
bun lint

# 4. Spin up local Supabase
bun supabase:start

# 5. Migrate
bun db:migrate

# 6. Run unit tests (audit-log-immutable.test.ts, encrypt.test.ts)
bun test

# 7. Try a direct push to main
git checkout main
git commit --allow-empty -m "test: should be blocked"
git push origin main  # MUST FAIL — ruleset rejects direct push
```

## Run plan

Phase -1 doesn't have a "running app" yet. The exit signal is: foundation is solid enough that Phase 0 (setup wizard) can build on it without re-doing infra work.

---

## Risks

- **Supabase local Docker quirks** — if `supabase start` fails, document workaround in `docs/17-operations.md` runbook
- **Better-Auth + Twitch OAuth** — Twitch requires HTTPS callback even for localhost; use a tunnel (cloudflared) and document
- **Strict TS catching real bugs in scaffold** — if scaffold output doesn't pass `noUncheckedIndexedAccess`, fix the scaffold output, don't relax the setting

---

## Files this phase touches

- `apps/server/src/auth.ts` — Better-Auth config
- `apps/server/src/trpc.ts` — middleware
- `packages/db/src/schema/*.ts` — userMeta, auditLogs, apiKeys, kvEncrypted
- `packages/db/src/migrations/*.sql` — audit log trigger
- `packages/logger/src/index.ts` — Pino instance with redaction
- `packages/shared/src/crypto/encrypt.ts`
- `packages/shared/src/roles.ts` — role enum + hasRoleAtLeast helper
- `.github/workflows/ci.yml`
- `.github/CODEOWNERS`
- `.github/ISSUE_TEMPLATE/*.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.husky/*`
- `commitlint.config.ts`
- `eslint.config.ts`
- `prettier.config.ts`
- `bunfig.toml`
- `.npmrc`
- `package.json` (root) — `engines`, `packageManager`, `scripts`, `preinstall`

---

## Definition of Done

PR titled `feat(foundation): phase -1 complete` opened against develop. PR description checks off every item above. CI green. Self-merge after waiting 1 hour (review-myself rule from `gh-solo-main-protection`). Then merge develop → main via PR (also self-merge).

After merge:

1. Update `PLAN.md` Phase -1 status → 🟢
2. Commit `docs(plan): mark phase -1 complete`
3. Tag: `git tag v0.0.1-foundation && git push --tags`
