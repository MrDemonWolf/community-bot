# Phase 3 — Moderation tools

**Goal:** Give mods the tools to enforce chat rules in both Twitch chat and Discord, with everything logged to the audit trail.

---

## Scope — IN

### Twitch

- [ ] `!ban <user> [reason]` — mod+ — Helix ban
- [ ] `!unban <user>` — mod+
- [ ] `!timeout <user> <seconds> [reason]` — mod+ — Helix timeout
- [ ] `!untimeout <user>` — mod+
- [ ] `!purge <user>` — mod+ — 1-second timeout (clears their messages)
- [ ] `!clear` — mod+ — clear all chat
- [ ] `!slow <seconds>` / `!slowoff` — mod+
- [ ] `!followers <duration>` / `!followersoff` — mod+ — followers-only chat mode
- [ ] `!subonly` / `!subonlyoff` — mod+
- [ ] `!emoteonly` / `!emoteonlyoff` — mod+
- [ ] `!uniquechat` / `!uniquechatoff` (formerly r9k) — mod+
- [ ] AutoMod settings reader (display current levels in dashboard, not chat command)
- [ ] Blocked terms management via dashboard (Helix `channels/moderation/blocked_terms`)

### Discord

- [ ] `/timeout <user> <duration> [reason]` — mod+ — Discord timeout
- [ ] `/ban <user> [reason] [delete-messages-days]` — mod+
- [ ] `/kick <user> [reason]` — mod+
- [ ] `/warn <user> <reason>` — mod+ — logs warning to DB, DMs user if possible
- [ ] `/warnings <user>` — mod+ — list warnings for a user
- [ ] `/purge <count>` — mod+ — delete last N messages in channel
- [ ] `/slowmode <seconds>` — mod+

### Shared

- [ ] Every moderation action writes to `auditLogs` with actor, target, action, reason, platform, raw payload
- [ ] Mod actions cross-posted to a configurable Discord channel ("mod-log") with embed
- [ ] Rate limit per mod (anti-runaway): max 30 mod actions per 60s per mod
- [ ] Dashboard mod log viewer with filters

## Scope — OUT

- ❌ AI severity scorer (explicitly won't do — see roadmap)
- ❌ Cross-platform user link (Phase 6 handles linking)
- ❌ Auto-mod rule editor (just expose Twitch AutoMod existing config; full rule editor is post-MVP)

---

## Acceptance criteria

1. `!timeout @user 60 "spam"` times user out for 60s, logs to audit, posts to mod-log channel
2. `/ban @user "ban evading"` bans user from Discord, logs to audit, posts to mod-log
3. Rate limit kicks in at 31st action within 60s, replies with cooldown remaining
4. Mod log viewer in dashboard filterable by mod, target, action type, date range
5. Discord warning DMs to user; warning still recorded if DM fails (user has DMs closed)

---

## Test plan

- Unit: command handlers with mocked Helix/Discord clients
- Integration: audit log entries assert
- Manual smoke on test channel

## Run plan

Same as Phase 2.

---

## Risks

- **Helix moderation scopes** — bot account needs to be added as Twitch moderator on broadcaster's channel; surface a clear error if not
- **Discord audit log lag** — Discord's own audit log can lag a few seconds; our DB audit is the source of truth
- **Mod action UI race** — two mods banning same user simultaneously; idempotency: second action returns "already banned"

---

## Definition of Done

PR merged. Tag `v0.3.0-moderation`.
