# community-bot — Phase Plan

> **Status legend:** 🔴 not started · 🟡 in progress · 🟢 done · ⏸ blocked
>
> **The deal:** main-only trunk. Every phase is a PR cycle: open a feature branch off `main`, PR back into `main`, green CI, self-merge after a 1-hour cool-down, then tag a version and update this file. Solo Main Protection ruleset is deferred to a follow-up; until then, treat PR-only as project policy. No `develop` branch.

---

## Phase -1 — Foundation hardening 🟡

See `docs/phases/phase--1-foundation.md`

- [ ] Bun-only enforced
- [ ] TS strict everywhere
- [ ] ESLint + Prettier + Husky + commitlint
- [ ] Pino logger package
- [ ] Drizzle migrations infra
- [ ] Initial schema (userMeta, auditLogs, apiKeys, kvEncrypted)
- [ ] Audit log append-only trigger
- [ ] Encryption helper with key versioning
- [ ] Better-Auth + tRPC role middleware
- [ ] Solo Main Protection ruleset
- [ ] CI pipeline
- [ ] Issue + PR templates
- [ ] `.env.example` complete

**Tag at end:** `v0.0.1-foundation`

---

## Phase 0 — Setup wizard 🔴

See `docs/phases/phase-00-setup-wizard.md`

- [ ] /setup route + first-run detection
- [ ] 8-step wizard
- [ ] Twitch broadcaster OAuth
- [ ] Twitch bot OAuth (same or separate account)
- [ ] Discord OAuth + bot invite
- [ ] Role mapping config
- [ ] Stream alert channel config
- [ ] Bot mode config
- [ ] Resumable state
- [ ] Audit trail

**Tag:** `v0.1.0-setup-wizard`

---

## Phase 1 — Discord MVP 🔴

See `docs/phases/phase-01-discord-mvp.md`

- [ ] apps/discord skeleton
- [ ] discord.js v14.26 wired
- [ ] /ping /links /uptime /about
- [ ] Activity rotation
- [ ] Stream-live alert
- [ ] Cross-post if announcements channel
- [ ] Graceful shutdown
- [ ] Sentry + correlation IDs
- [ ] tRPC bridge for dashboard

**Tag:** `v0.1.0-discord-mvp`

---

## Phase 2 — Twitch MVP 🔴

See `docs/phases/phase-02-twitch-mvp.md`

- [ ] apps/twitch skeleton (@twurple 8.1.4)
- [ ] RefreshingAuthProvider with both accounts
- [ ] ChatClient + EventSubWsListener
- [ ] EventSub subscriptions list
- [ ] Command runtime + template engine
- [ ] Timer runtime
- [ ] 12 MVP commands: uptime, followage, accountage, game, title, commands, addcom, editcom, delcom, marker, clip, commercial, vanish, ping
- [ ] Default commands + timers seeded on first deploy

**Tag:** `v0.2.0-twitch-mvp`

---

## Phase 3 — Moderation 🔴

See `docs/phases/phase-03-moderation.md`

- [ ] Twitch mod commands (ban/timeout/purge/clear/slow/followers/subonly/emoteonly/uniquechat)
- [ ] Discord mod commands (timeout/ban/kick/warn/warnings/purge/slowmode)
- [ ] Mod actions to audit log
- [ ] Mod log channel cross-post
- [ ] Mod rate limit
- [ ] Dashboard mod log viewer

**Tag:** `v0.3.0-moderation`

---

## Phase 4 — Brain Cells loyalty 🔴

See `docs/phases/phase-04-loyalty.md`

- [ ] Watchtime tracker
- [ ] brainCellsLedger append-only
- [ ] Earn rules (watch/chat/sub/cheer/raid)
- [ ] !points !top !addpoints !removepoints !givepoints (Later set; seeded disabled)
- [ ] Redeem engine
- [ ] Anti-abuse heuristics

**Tag:** `v0.4.0-brain-cells`

---

## Phase 5A — Flows declarative 🔴

See `docs/phases/phase-05a-flows-declarative.md`

- [ ] xyflow integrated
- [ ] Node catalog (triggers/conditions/actions)
- [ ] Server executor
- [ ] Audit + replay debugger
- [ ] Publish/unpublish + versioning
- [ ] Brain Cells redeem template ships

**Tag:** `v0.5.0-flows-declarative`

---

## Phase 5B — Flows sandboxed JS 🔴

See `docs/phases/phase-05b-flows-sandbox.md`

- [ ] quickjs-emscripten integrated
- [ ] Sandbox limits enforced
- [ ] Custom JS node
- [ ] Broadcaster-only publish gate
- [ ] Domain allowlist for fetch
- [ ] Test runner UI

**Tag:** `v0.5.1-flows-sandbox`

---

## Phase 6 — Roles + Den 🔴

See `docs/phases/phase-06-role-sync.md`

- [ ] userMeta linking flow
- [ ] !link / /link commands
- [ ] Sub → Discord role sync (both directions)
- [ ] VIP sync
- [ ] Reconcile cron
- [ ] /den page (sub-only)
- [ ] denPosts + comments

**Tag:** `v0.6.0-roles-and-den`

---

## Phase 7 — Import wizard 🔴

See `docs/phases/phase-07-import.md`

- [ ] /setup/import route
- [ ] StreamElements parser
- [ ] Nightbot parser
- [ ] Fossabot parser
- [ ] Variable compat matrix enforced
- [ ] Dry-run preview
- [ ] Idempotency by file hash

**Tag:** `v0.7.0-import-wizard`

---

## Phase 8 — AI features 🔴

See `docs/phases/phase-08-ai.md`

- [ ] @google/genai wired (Gemini 3 Flash + Flash-Lite)
- [ ] Smart shoutout
- [ ] Title suggester
- [ ] Stream recap
- [ ] Clip titler
- [ ] Hype train co-pilot (approval-gated)
- [ ] Guardrail (every output filtered)
- [ ] Cost cap $25/mo + auto-disable
- [ ] EU AI Act labeling on all viewer-facing AI output

**Tag:** `v0.8.0-ai-features`

---

## Phase 9 — GDPR + release 🔴

See `docs/phases/phase-09-gdpr-release.md`

- [ ] Privacy policy + cookie banner if needed
- [ ] DPIA documented
- [ ] Data subject rights endpoints
- [ ] Retention policy (audit log partitions)
- [ ] Dokploy deploy
- [ ] DNS + TLS
- [ ] Sentry prod
- [ ] Status page
- [ ] CHANGELOG.md
- [ ] Docs site published

**Tag:** `v1.0.0`

---

## Phase 10+ 🔴

See `docs/20-roadmap.md`. Scope one phase at a time.

---

## Process notes

- Trunk-based: one feature branch per phase off `main`.
- PR to `main` → squash-merge after CI green and the 1-hour cool-down.
- Solo Main Protection direct-push rejection is planned in a follow-up; until then, treat PR-only as project policy.
- Tag at end of each phase (`git tag vX.Y.Z-name && git push --tags`).
- Always update this file when status changes. Commit message: `docs(plan): mark phase N <status>`.
