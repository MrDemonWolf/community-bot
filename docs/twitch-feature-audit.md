# Community Bot — Twitch Feature Audit Report

**Date:** 2026-03-01
**Branch:** `feat/twitch-expansion`
**Auditor:** Claude Code

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Implemented | 72 |
| ⚠️ Partial | 3 |
| ❌ Missing (wanted) | 52 |
| ⏭️ Skipped (not wanted) | 14 |

---

## Category 1: Chat Moderation & Spam Filters

### Filters

| Filter | Status | Notes |
|--------|--------|-------|
| Link Filter | ✅ | Regex-based, `linksAllowSubs`, permit bypass |
| Caps Filter | ✅ | `capsMinLength` + `capsMaxPercent` thresholds |
| Symbol Filter | ✅ | `symbolsMaxPercent` threshold |
| Emote Spam Filter | ⚠️ Partial | Uses word count as proxy — doesn't use Twitch emote API |
| Repetition Filter | ✅ | Repeated chars + repeated words |
| Banned Words | ✅ | Case-insensitive substring, up to 500 terms |
| Message Length Filter | ❌ Wanted | Max/min character count per message |
| One-Man Spam Detection | ❌ Wanted | Cross-message tracking per user for repeat spam |
| Homoglyph/Lookalike Protection | ❌ Wanted | Unicode normalization for banned word bypass prevention |

### Filter Settings

| Setting | Status |
|---------|--------|
| Enable/disable per filter | ✅ |
| Global exempt level | ✅ |
| Global timeout duration | ✅ |
| Global warning message | ✅ |
| Per-filter timeout duration | ❌ Wanted |
| Per-filter exempt levels | ❌ Wanted |
| Warning → timeout → ban escalation | ❌ Wanted (configurable ladder) |
| Silent mode | ❌ Not wanted |

### Moderation Commands

| Command | Status |
|---------|--------|
| `!permit` | ✅ |
| `!nuke` | ⚠️ Partial (text-only, no regex, no rollback) |
| `!vanish` | ✅ |
| `!timeout`/`!ban`/`!unban` | ❌ Wanted |
| `!slow`/`!followersonly`/`!subonly`/`!emoteonly` | ❌ Wanted |

### Wanted Changes
- Add message length filter, one-man spam detection, homoglyph protection
- Per-filter timeouts and per-filter exempt levels
- Configurable escalation: warning → timeout (e.g., 10 min) → ban
- Upgrade `!nuke` with regex matching and `!unnuke` rollback
- Add `!timeout`/`!ban`/`!unban` commands
- Add `!slow`/`!followersonly`/`!subonly`/`!emoteonly` chat mode commands

---

## Category 2: Custom Commands System

### Core Features

| Feature | Status |
|---------|--------|
| Command CRUD (chat) | ✅ `!command add/edit/remove/show/options` |
| Command CRUD (dashboard) | ✅ Full tRPC + modal form |
| Response types: Say, Mention, Reply | ✅ |
| Response type: Whisper | ❌ Wanted |
| Global cooldown | ✅ In-memory |
| Per-user cooldown | ✅ In-memory |
| Access levels (7 tiers) | ✅ |
| Online/Offline toggle | ✅ |
| Aliases (up to 10) | ✅ |
| Hidden commands | ✅ |
| Command expiry | ⚠️ Field exists, no enforcement job |
| Regex triggers | ✅ |
| Title keywords filter | ✅ |
| Limit to user | ✅ |

### Variables (30+ implemented)

`{user}`, `{channel}`, `{touser}`, `{args}`, `{query}`, `{count}`, `{uptime}`, `{followage}`, `{accountage}`, `{game}`, `{title}`, `{random.N-M}`, `${random.pick}`, `${random.chatter}`, `{weather}`, `{math}`, `{countdown}`, `{countup}`, `{customapi}`, `{subcount}`, `{chatters}`, `{7tvemotes}`, `{bttvemotes}`, `{ffzemotes}`, `${time TZ}`, `${N}` positional args

**Missing variables wanted:** `{viewers}` (Twitch viewer count), `{quote}` (inline random quote)

### Built-in Commands (22 implemented)

`!ping`, `!uptime`, `!accountage`, `!bot`, `!queue`, `!command`, `!reloadcommands`, `!filesay`, `!commands`, `!title`, `!game`, `!followage`, `!shoutout`/`!so`, `!quote`, `!counter`, `!permit`, `!nuke`, `!vanish`, `!clip`, `!sr`, `!poll`, `!giveaway`

**Missing built-ins wanted:** `!marker`, `!commercial`

### Wanted Changes
- Add Whisper response type
- Fix command expiry (add scheduled job to auto-disable expired commands)
- Add `{viewers}` and `{quote}` variables
- Add `!marker` and `!commercial` built-in commands

---

## Category 3: Timers & Scheduled Messages

| Feature | Status |
|---------|--------|
| Timer CRUD (dashboard) | ✅ |
| Interval config (1–1440 min) | ✅ |
| Min chat lines threshold | ✅ |
| Enable/disable toggle | ✅ |
| Variable support | ✅ Full reuse from commandExecutor |
| Live-only guard | ✅ |
| Timer CRUD (chat) | ❌ Wanted |
| Separate online/offline intervals | ❌ Wanted |
| Game filter | ❌ Wanted |
| Title keyword filter | ❌ Wanted |
| Message rotation | ❌ Wanted (sequential/random) |
| Alias to command | ❌ Wanted |

### Wanted Changes
- Add `!timer` chat command (add/edit/delete/list)
- Separate online/offline intervals
- Game filter and title keyword filter
- Message rotation (multiple messages per timer, sequential or random)
- Alias to command (timer triggers an existing command)

---

## Category 4: Channel Points / Brain Cells

**Current state:** No loyalty/points system exists.

### Wanted Features
- **"Brain Cells" as a Twitch Channel Point redemption** with per-user count tracking
- Fully customizable in the dashboard (reward name, cost, etc.)
- Per-user leaderboard in dashboard
- Command cost via Channel Points
- EventSub listener for Channel Point redemptions
- ⏭️ Skip: independent currency, gambling, store, watchtime tracking

---

## Category 5: Song / Media Requests

| Feature | Status |
|---------|--------|
| YouTube (URL + search) | ✅ |
| `!sr` commands (add, list, skip, remove, clear) | ✅ |
| Queue limits (max size + per-user) | ✅ |
| Duration limits | ✅ |
| Backup playlist + auto-play | ✅ |
| Browser source overlay | ✅ |
| Search by name | ✅ |
| Dashboard + public page | ✅ |
| Voteskip | ❌ Wanted |
| Track banning | ❌ Wanted |
| `!wrongsong` | ❌ Wanted |
| SoundCloud support | ❌ Wanted |
| ⏭️ Spotify | Skipped |
| ⏭️ Moderation/approval queue | Skipped |

### Wanted Changes
- Voteskip with configurable vote threshold
- Track banning (block specific video IDs)
- `!wrongsong` command (requester removes their own last request)
- SoundCloud URL/search support

---

## Category 6: Alerts & Overlays

**Current state:** Only `/overlay/song-requests` exists.

### Wanted Features
- EventSub listeners for all event types (bot actions, chat messages, auto-shoutout)
- **NO visual overlay alerts** — using Twitch's built-in alerts
- ⏭️ Skip: custom alert overlays, widget builder

---

## Category 7: Giveaways & Contests

| Feature | Status |
|---------|--------|
| Keyword-based entry | ✅ |
| `!giveaway` commands | ✅ |
| Dashboard UI + history | ✅ |
| Duplicate prevention | ✅ |
| Winner announcement | ✅ |
| Reroll | ✅ |
| Audit logging | ✅ |
| Eligibility filters | ❌ Wanted |
| Subscriber luck multiplier | ❌ Wanted |
| Multi-winner draw | ❌ Wanted |

### Wanted Changes
- Eligibility filters (follower-only, subscriber-only, min account age)
- Subscriber luck multiplier (weighted entries)
- Multi-winner draw (draw N winners at once)

---

## Category 8: Dashboard & Analytics

| Feature | Status |
|---------|--------|
| Web dashboard (20+ pages) | ✅ |
| Audit log (role-based) | ✅ |
| Public pages (commands, quotes, queue, song requests) | ✅ |
| Quick stats | ✅ |
| Real-time (React Query polling) | ✅ |
| Stream info editing (title/game) | ❌ Wanted |
| Chat logs with search | ❌ Wanted |
| Command usage stats/charts | ❌ Wanted |
| Twitch mod action logs | ❌ Wanted |
| Full viewer analytics | ❌ Wanted |
| Auth required on page (not toast) | ❌ Wanted (UX fix) |

### Wanted Changes
- Stream title/game editing via Helix PATCH
- Chat message log storage with search and retention policy
- Command usage statistics with charts/tables
- Twitch moderation action logs (persisted timeouts/bans)
- Full viewer analytics: peak viewers, unique chatters, trends, session history
- Show "Authentication required" on the page instead of toast

---

## Category 9: User Roles & Permissions

| Feature | Status |
|---------|--------|
| 7-tier role hierarchy | ✅ |
| Per-command permissions | ✅ |
| Per-filter exemptions (global) | ✅ |
| Dashboard access control | ✅ |
| User management | ✅ |
| Default command overrides | ✅ |
| Regulars system | ✅ |
| Per-filter exempt levels | ❌ Wanted |

### Wanted Changes
- Per-filter exempt levels (each filter gets its own exempt level)

---

## Category 10: Twitch-Specific Integrations (MAJOR)

**Current state:** Zero EventSub. All Helix via raw `fetch`. Narrow OAuth scopes.

| Feature | Status |
|---------|--------|
| Stream status polling | ✅ (60s Helix poll) |
| Helix: read title/game/viewers | ✅ |
| Helix: create clips | ✅ |
| Helix: create/manage polls | ✅ |
| Helix: subscriber/follower count | ✅ |
| Emote fetching (7TV/BTTV/FFZ/Twitch) | ✅ |
| OAuth refresh (chat) | ✅ |
| **EventSub: ALL events** | ❌ Wanted |
| **Stream status via EventSub** | ❌ Wanted (replace polling) |
| Helix: set title/game | ❌ Wanted |
| Helix: stream markers | ❌ Wanted |
| Helix: commercials | ❌ Wanted |

### Wanted Changes
- Install `@twurple/api` + `@twurple/eventsub-ws`
- Full EventSub WebSocket integration for ALL events:
  - Channel Points redemptions, Raids, Follows, Subs/Resubs/Gifts
  - Cheers/Bits, Bans/Timeouts, Hype Train, Predictions
  - Ad breaks, Shield Mode, Shoutouts, Whispers
  - Stream online/offline (replace 60s polling)
- Expand OAuth scopes to support all EventSub subscriptions
- Helix PATCH for title/game editing
- Helix POST for stream markers and commercials

---

## Category 11: API & External Integrations

| Feature | Status |
|---------|--------|
| REST API (health check) | ✅ |
| Discord integration (EventBus) | ✅ |
| StreamElements import | ✅ |
| YouTube integration | ✅ |
| Google Gemini AI | ✅ |

No new external integrations wanted.

---

## Category 12: Quality of Life

| Feature | Status |
|---------|--------|
| Hot-reload config (EventBus) | ✅ |
| Health monitoring | ✅ |
| StreamElements import | ✅ |
| AI-enhanced shoutouts | ✅ |
| Auto-shoutout raiders | ❌ Wanted (toggleable) |
| Welcome messages | ❌ Wanted (toggleable) |
| `!lurk` / `!unlurk` | ❌ Wanted (toggleable) |
| First-message detection | ❌ Wanted (toggleable) |
| Social links (dashboard-managed) | ❌ Wanted (like linkden app) |
| Auto-thank subscribers | ❌ Wanted (toggleable, requires EventSub) |

### Wanted Changes
- Auto-shoutout raiders (toggleable in dashboard)
- Welcome messages for new/returning chatters (toggleable)
- `!lurk` / `!unlurk` commands (toggleable)
- First-message detection and flagging (toggleable)
- Social links with easy dashboard management (add/edit/remove links)
- Auto-thank subscribers on new sub/resub/gift (toggleable, requires EventSub)
- **All QoL features must be individually enable/disable toggleable**

---

## Priority Action Items

1. **EventSub infrastructure** — Foundation for Channel Points, raids, subs, cheers, and everything else. Install `@twurple/api` + `@twurple/eventsub-ws`, expand OAuth scopes.
2. **Brain Cells / Channel Points** — Channel Point redemption with per-user tracking and dashboard management.
3. **Moderation upgrades** — Escalation system (warn→timeout→ban), new filters (message length, one-man spam, homoglyph), per-filter settings.
4. **Timer enhancements** — Game filter, message rotation, online/offline intervals, `!timer` chat command.
5. **Analytics pipeline** — Chat logs, viewer stats, mod action logs, command usage stats.
6. **Song request improvements** — Voteskip, track banning, `!wrongsong`, SoundCloud.
7. **QoL features** — Welcome messages, auto-shoutout, lurk, first-message, social links, auto-thank subs.
8. **Giveaway upgrades** — Eligibility filters, sub luck multiplier, multi-winner.

## Architecture Notes

- **EventSub is the biggest infrastructure change** — requires `@twurple/eventsub-ws`, expanded OAuth scopes, and a new event dispatch layer connecting EventSub events to bot actions.
- **Helix calls currently use raw `fetch`** without token caching — consider migrating to `@twurple/api` for automatic token management and retry on 401s.
- **Chat logs + viewer analytics** need new DB models with retention policies (e.g., 90-day rolling window) to avoid unbounded table growth.
- **Per-filter timeouts/exempt levels** require a schema migration to split `SpamFilter` into per-filter config fields.
- **Brain Cells tracking** needs a new model linking Twitch user IDs to Channel Point redemption counts per channel.
- **All new QoL features** should follow the existing pattern: DB-backed config with EventBus reload, toggleable from dashboard, audit-logged.
