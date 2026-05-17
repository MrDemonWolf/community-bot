# 05 — GDPR compliance

Single-streamer self-hosted bot. **Streamer (Nathanial) is the data controller.** No SaaS; no joint controllership. Documented in `docs/19-decisions.md → ADR-007`.

## Lawful bases

| Processing                         | Lawful basis                                                  | Article      |
| ---------------------------------- | ------------------------------------------------------------- | ------------ |
| Chat commands + viewer counters    | Legitimate interest (running a chat bot is core to streaming) | Art. 6(1)(f) |
| Loyalty (Brain Cells)              | Legitimate interest + opt-out                                 | Art. 6(1)(f) |
| Discord role sync                  | Consent (explicit account link)                               | Art. 6(1)(a) |
| AI features targeting named viewer | Consent (explicit opt-in)                                     | Art. 6(1)(a) |
| Mod actions + audit log            | Legitimate interest (community safety)                        | Art. 6(1)(f) |
| GDPR data subject responses        | Legal obligation                                              | Art. 6(1)(c) |

## Data subject rights — implemented

- **Art. 15 (access):** `/privacy/me` route + `!mydata` bot command → DM with link to signed S3 URL (Supabase Storage)
- **Art. 16 (rectification):** mod can edit/update userMeta; viewer can request via `!mydata` reply
- **Art. 17 (erasure):** `/privacy/me` "Delete my data" button + `!forgetme` bot command → cascade delete
- **Art. 18 (restriction):** mark `restricted` in userMeta — bot stops storing, mods notified
- **Art. 20 (portability):** export is JSON, machine-readable
- **Art. 21 (object):** `aiOptOut` flag for AI processing

## Implementation checklist (Phase 9)

- [ ] `/privacy/me` route (auth-required Twitch+Discord OAuth)
- [ ] `!mydata` Twitch + Discord command → DMs link
- [ ] `!forgetme` Twitch + Discord command → confirmation flow + 24h grace period + cascade delete
- [ ] Export endpoint: `/api/privacy/me/export` → signed URL valid 7 days
- [ ] Cascade delete with anonymization for audit log preservation
- [ ] Retention policy `settings.retention.*`:
  - `eventsDays` (default 90)
  - `chatLogsDays` (default 30)
  - `deletedMessageCacheDays` (default 7)
  - `flowTracesDays` (default 30)
  - `auditLogsDays` (default 730 — 2 years, mod accountability)
- [ ] `pg_cron` purge jobs for each
- [ ] Backup restore drill (quarterly)
- [ ] Public sub-processor list at `/legal/sub-processors`:
  - Supabase (DB + Storage + Realtime; EU region selected at signup)
  - Cloudflare (if used for proxy — optional)
  - Apple WeatherKit (only if `!weather` enabled)
  - Google (Gemini AI; only if AI addon enabled)
  - Twitch (platform; data subject knows)
  - Discord (platform; data subject knows)
- [ ] Public privacy policy at `/legal/privacy` (Fumadocs)
- [ ] ROPA (Record of Processing Activities) at `docs/legal/ropa.md`
- [ ] Breach runbook at `docs/legal/breach-runbook.md`
- [ ] Mod AUP (Acceptable Use Policy) signed before mod role granted

## DPIA — AI features

Phase 8 trigger: small DPIA required because AI processes user content + writes about specific named users.

Documented in `docs/legal/dpia-ai.md`. Covers:

- Purpose: shoutout / title / recap / hype / clip titles
- Data flow: → guardrail → Gemini → guardrail → chat
- Data minimization: only `targetHandle`, `lastGame`, `recentClipTitles` for shoutout. No PII.
- Retention: prompt + output hashes only (16-byte) in audit log. No raw prompts stored.
- Risk: low. Mitigations: per-feature toggle, per-user opt-out, content guardrail, max 1 minor (under 18) features (none target minors specifically)
- Approval: broadcaster reads + signs in dashboard

## EU AI Act labeling

Per Art. 50 (transparency): AI-generated chat content must be labeled. Setting `addons.ai.labelOutputs` (default `true`). Each AI-generated chat message prefixed with `🤖 ` or suffixed with ` (AI)`.

## Pre-release checklist (Phase 9)

- [ ] Real restore-from-backup test successful
- [ ] All secrets rotated
- [ ] 2FA on Discord, Twitch, Google, Dokploy, GitHub, VPS, Supabase
- [ ] First mod onboarded → AUP signed + reduced role granted
- [ ] Stream Discord post: "What community-bot does + privacy + how to opt out"
- [ ] Twitch panel link to privacy policy
- [ ] Verify no PII logged in stdout/stderr
- [ ] Verify `audit_logs` UPDATE/DELETE triggers active

## Quarterly review checklist

- [ ] Anyone left the mod team? → revoke roles + invalidate sessions
- [ ] New AI features? → DPIA addendum + consent UX updated
- [ ] Any subject requests open >30 days? → action
- [ ] Last restore test within 3 months?
- [ ] Sub-processor list still accurate?
