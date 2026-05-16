# Phase 1 — Discord bot MVP

**Goal:** A Discord bot that's online, responds to slash commands, posts stream-live alerts, and handles graceful shutdown. NOT the moderation/role-sync stuff — that's Phase 3 and 6.

**Why Discord first:** Easier than Twitch (no EventSub WebSocket churn, no IRC gateway), proves the `apps/discord` service shape, gives us a working bot users can interact with before tackling Twitch.

---

## Scope — IN

- [ ] `apps/discord` service skeleton (TypeScript, discord.js v14.26+)
- [ ] Gateway connection with privileged intents (Server Members, Message Content)
- [ ] Slash command registration on bot startup (guild-scoped during dev, global on prod)
- [ ] Slash commands to ship:
  - [ ] `/ping` — health check, replies with latency
  - [ ] `/links` — sends embed with Twitch/Discord/other links from `appConfig`
  - [ ] `/uptime` — bot's own process uptime
  - [ ] `/about` — bot version, source link, made-with-love footer
- [ ] Activity rotation: configurable list of statuses cycled every N minutes (default: "Watching MrDemonWolf grow", "Listening to chat", "Playing with Brain Cells")
- [ ] Stream-live alert: when Twitch reports stream online (Phase 2 fires this), Discord bot posts configured embed in configured channel
- [ ] Cross-post to announcements channel if configured (Discord native feature)
- [ ] Graceful shutdown: SIGTERM → finish in-flight handlers → close gateway → exit 0
- [ ] Pino logging with correlation IDs per interaction
- [ ] Sentry instrumentation
- [ ] tRPC bridge so dashboard can query Discord bot state (current activity, latency, guild count)

## Scope — OUT

- ❌ Moderation commands (Phase 3)
- ❌ Role sync to Twitch (Phase 6)
- ❌ The Den (Phase 6)
- ❌ Reaction roles (Phase 6+)
- ❌ Brain Cells balance command (Phase 4)

---

## Acceptance criteria

1. Bot connects on `bun dev`, shows online in Discord
2. `/ping` round-trips in < 200ms p95
3. Activity rotates per configured interval
4. Triggering a fake stream-live event via dev endpoint posts the embed correctly
5. SIGTERM → bot finishes handlers, no orphaned messages, exits 0
6. Gateway disconnect → reconnect with exponential backoff
7. Dashboard `/status` page shows bot online + latency

---

## Test plan

- Unit: slash command handlers in isolation with mocked Interaction
- Integration: spin up a test guild, register commands, run /ping, assert reply
- Manual: kill -SIGTERM the dev process, verify clean shutdown logs

## Run plan

```bash
# Terminal 1 — server + Discord bot
bun dev
# Terminal 2 — Discord
# Use a dev test guild (separate from real community)
# Invite bot with: https://discord.com/api/oauth2/authorize?client_id=...&permissions=...&scope=bot+applications.commands
```

---

## Risks

- **discord.js v14 breaking changes** — pin to `^14.26` and verify before each Phase
- **Gateway disconnect storms** — exponential backoff with jitter, cap at 5 min
- **Slash command propagation delay (global)** — up to 1 hour; use guild-scoped during dev

---

## Definition of Done

PR merged. PLAN.md updated. Tag: `v0.1.0-discord-mvp`.
