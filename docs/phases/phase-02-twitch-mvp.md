# Phase 2 — Twitch bot MVP

**Goal:** Twitch bot connects, joins channel, responds to the 12 MVP commands, runs timers, fires stream-online/offline events to the rest of the system.

**This is the big one.** Most of the actual community-facing surface ships here.

---

## Scope — IN

### Service infra

- [ ] `apps/twitch` service (TypeScript, @twurple v8.1.4)
- [ ] `RefreshingAuthProvider` wired with both broadcaster + bot tokens (encrypted at rest, decrypted on load)
- [ ] `ChatClient` for IRC (PRIVMSG, USERNOTICE, CLEARCHAT)
- [ ] `EventSubWsListener` for real-time Twitch events
- [ ] EventSub subscriptions (initial set):
  - [ ] `stream.online` → fires Discord alert, sets `streamState.live = true`
  - [ ] `stream.offline` → updates state, marks stream session ended
  - [ ] `channel.update` → tracks title/category changes (for `!title`, `!game`)
  - [ ] `channel.follow` → for `!followage` (note: now requires moderator scope as of Twitch policy change)
  - [ ] `channel.cheer` → reserved for Phase 4 (Brain Cells)
  - [ ] `channel.subscribe` → reserved for Phase 4 + Phase 6 (role sync)
  - [ ] `channel.subscription.gift` → reserved
  - [ ] `channel.raid` → reserved for Phase 8 raid AI
  - [ ] `channel.chat.notification` → for future events
  - [ ] `stream.online` reconcile on bot start (catch up if we missed it)

### Command runtime

- [ ] Command parser respecting bot's prefix (`!` default, configurable per server later — Phase 7+ has multi-tenant ambition but we're single-broadcaster for MVP)
- [ ] Cooldown enforcement (global + per-user)
- [ ] Permission check (which role can run each command)
- [ ] Template engine for response strings: `${user}`, `${target}`, `${channel}`, `${game}`, `${title}`, `${uptime}`, `${followage}`, `${accountage}`, `${touser}` (target arg fallback to sender), `${random.N-M}`, `${count}` (per-command counter), etc.
- [ ] Counter persistence (for future `!count` etc., even though `!count` is in Later set)
- [ ] Built-in command dispatcher (the 12 below)

### The 12 MVP commands

- [ ] `!uptime` — viewers — replies with current stream uptime or "stream is offline"
- [ ] `!followage` — viewers — defaults to sender, accepts arg for someone else
- [ ] `!accountage` — viewers — Twitch account creation age
- [ ] `!game` — viewers — current category
- [ ] `!title` — viewers — current title
- [ ] `!commands` — viewers — links to public commands page on dashboard
- [ ] `!addcom <!name> <response>` — mod+ — add a custom command; auto-creates DB row
- [ ] `!editcom <!name> <response>` — mod+ — edit existing
- [ ] `!delcom <!name>` — mod+ — soft-delete (sets `deletedAt`)
- [ ] `!marker <text>` — mod+ — creates a Twitch stream marker via Helix API; `text` becomes marker description
- [ ] `!clip` — mod+ — creates a clip via Helix API; replies with URL
- [ ] `!commercial <seconds>` — broadcaster only — runs commercial via Helix API; valid lengths 30/60/90/120/150/180
- [ ] `!vanish` — viewers (self-purge) — bot times the sender out for 1 second; common QoL command
- [ ] `!ping` — mod+ — health check; bot replies "pong"

### Timer runtime

- [ ] Timer evaluator (interval-based, runs while stream is live unless `runWhenOffline = true`)
- [ ] Minimum-chat-line throttle (don't fire if fewer than N lines since last fire)
- [ ] Round-robin if multiple timers due in same tick

### Seeds

- [ ] Seed runs on first Phase 2 deploy: insert default commands + timers from `packages/db/src/seed/`

## Scope — OUT

- ❌ Loyalty (Phase 4)
- ❌ Setting title/game from chat (`!title <new>`, `!game <new>` are in Later set — seeded disabled)
- ❌ Shoutouts (Phase 8 AI version, Phase 4 manual version uses `!so` which is also Later)
- ❌ Moderation commands (Phase 3)
- ❌ Flow builder triggers (Phase 5)

---

## Acceptance criteria

1. Bot connects to IRC and joins broadcaster's channel
2. EventSub WebSocket connects, subscriptions all in `enabled` state
3. `!ping` from broadcaster receives "pong" within 500ms
4. `!uptime` returns correct duration during live stream
5. `!followage` against a known follower returns expected duration
6. `!clip` actually creates a clip on Twitch
7. `!commercial 30` runs a 30s ad break (test ONLY when broadcaster is partner/affiliate)
8. `!addcom !test hello` creates a row; `!test` then replies "hello"
9. `!delcom !test` soft-deletes; `!test` no longer fires
10. Bot reconnects gracefully if IRC drops
11. Bot reconnects gracefully if EventSub drops
12. Stream-online event fires Discord alert (cross-service integration)
13. Default timers fire on schedule during live stream

---

## Test plan

```bash
# Unit
bun test apps/twitch/src/commands/*.test.ts
bun test apps/twitch/src/template-engine.test.ts

# Integration (mocked Twitch)
bun test apps/twitch/src/integration/*.test.ts

# Live smoke test (manual, on actual Twitch with throwaway channel)
# - Start a private test stream
# - Run each of the 12 commands
# - Verify timer fires
```

## Run plan

```bash
bun dev  # spawns server + discord + twitch services
# Bot auto-joins broadcaster's channel based on appConfig
```

---

## Risks

- **EventSub WebSocket session timeouts** — twurple handles reconnect but watch the logs first week
- **Rate limits on Helix** — clip + commercial endpoints have low limits; surface error to chat gracefully ("clip failed: rate limited, try again in 30s")
- **`!followage` scope** — Twitch changed follow data to require moderator scope; broadcaster account must have moderator scope on its own channel (yes, weird but true)
- **Helix clip creation latency** — clip endpoint can take 5-10 seconds; bot must reply with "creating clip..." then edit message or post follow-up

---

## Definition of Done

PR merged. PLAN.md updated. Tag: `v0.2.0-twitch-mvp`. Manual smoke test recorded in PR description.
