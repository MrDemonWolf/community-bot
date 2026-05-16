# Phase 9 — GDPR + release prep

**Goal:** Everything in `docs/05-gdpr.md` implemented end-to-end. Ready for public soft-launch.

---

## Scope — IN

- [ ] Privacy policy page (public, generated from gdpr-compliance skill)
- [ ] Cookie banner (only if we set non-essential cookies; default is no)
- [ ] DPIA (Data Protection Impact Assessment) for AI features documented
- [ ] Data subject rights endpoints:
  - [ ] `GET /api/me/export` — full data export as JSON
  - [ ] `POST /api/me/delete` — soft-delete + 30-day hard-delete cron
  - [ ] `PATCH /api/me` — correction
  - [ ] `POST /api/me/restrict` — restrict processing
  - [ ] `POST /api/me/object` — object to processing (disables AI features for this user)
- [ ] Data retention policy: auditLogs partitioned monthly, drop > 24 months
- [ ] Encryption at rest verified for: refresh tokens, link codes, API keys
- [ ] Dokploy deploy infra ready (see `docs/09-dokploy-guide.md`)
- [ ] Two Dokploy projects deployed: `community-bot-infra` + `community-bot`
- [ ] Backups configured: Supabase daily snapshots → R2/S3, retention 30 days
- [ ] DNS records: bot/bot-api/bot-twitch/bot-discord.mrdemonwolf.com → Traefik
- [ ] TLS via Let's Encrypt auto-cert through Traefik
- [ ] Sentry production project + DSN configured
- [ ] Status page (statuspage on `bot-status.mrdemonwolf.com`, simple manual)
- [ ] CHANGELOG.md generated from Conventional Commits
- [ ] Public docs site published via Fumadocs to `bot-docs.mrdemonwolf.com` (or GitHub Pages if simpler)

## Scope — OUT

- ❌ Multi-tenant (this is single-broadcaster forever — see ADR)
- ❌ White-labeling (not happening)

---

## Acceptance criteria

1. Privacy policy live, links from footer everywhere
2. Data export returns complete JSON within 30 days SLA (we aim for instant)
3. Delete request soft-deletes immediately, hard-deletes in 30 days, audit retained
4. Encryption helper test verifies all sensitive fields encrypted in DB dumps
5. Production deploy succeeds via Dokploy
6. CI green; manual smoke green
7. Status page reachable
8. Backups verified by restore drill (Phase -1 runbook)

## Test plan

- E2E: full data export → import to fresh account → verify shape
- Restore drill: actual restore from backup → verify integrity
- Penetration test (self-administered): OWASP Top 10 checklist

## Run plan

Production smoke test. Soft-launch.

---

## Risks

- **GDPR fines** — Nathanial is data controller; this is real legal risk. Privacy policy reviewed before going live.
- **Backup restore failure** — drill must succeed before launch

## Definition of Done

PR merged. Tag `v1.0.0`. Public soft-launch.
