# 01 — Architecture

## The five-line summary

1. **State** → Postgres (Drizzle schemas)
2. **Jobs** → `pgmq` queues, polled by Bun workers
3. **Schedules** → `pg_cron` enqueues `pgmq` jobs
4. **Live UI** → Supabase Realtime Broadcast → React
5. **Secrets** → AES-256-GCM at-rest in Postgres

## Why Supabase-only (no Redis/BullMQ)

Less to run. Less to break. One backup covers everything. `pgmq` + `pg_cron` are battle-tested Postgres extensions. Redis-only wins (sub-millisecond latency, blocking ops, Lua scripts) don't apply at our scale (one streamer + mods). When you scale to 100 streamers, revisit.

## Services

| Service | Path | Public? | Notes |
|---|---|---|---|
| Web | `apps/web` | Yes (`bot.mrdemonwolf.com`) | TanStack Router, Tailwind, shadcn/ui, PWA |
| API | `apps/server` | Yes (`bot-api.mrdemonwolf.com`) | Hono + tRPC + Better-Auth |
| Docs | `apps/docs` | Yes (GitHub Pages) | Fumadocs |
| Twitch worker | `apps/twitch` | No (internal health on `bot-twitch.mrdemonwolf.com`) | @twurple v8, IRC chat, EventSub WS |
| Discord worker | `apps/discord` | No (internal health on `bot-discord.mrdemonwolf.com`) | discord.js v14, gateway |

## Packages

| Package | Purpose | Owner phase |
|---|---|---|
| `db` | Drizzle schemas + migrations + seeds | -1 |
| `shared` | Zod, template engine, helpers, types | -1 |
| `jobs` | pgmq wrappers, worker base, retry/DLQ | -1 |
| `flow-engine` | Graph type, runtime executor | 5A |
| `sandbox` | QuickJS host wrapper | 5B |
| `ai` | Gemini client, prompts, guardrail | 8 |
| `plugins` | Plugin loader + APIs for `roll-dice`, etc. | 3 |

## Data flow examples

### Twitch chat message → command response

1. `@twurple/chat` parses incoming message
2. `apps/twitch` matches against `commands` table (cached in-process)
3. If match → template render via `packages/shared/template`
4. Apply variable resolvers (Helix calls for `${uptime}` etc.)
5. Post reply via `@twurple/chat` IRC
6. Audit log row written if mod-only command
7. Realtime broadcast `commands.fire` → dashboard shows live log

### Twitch sub → Discord role

1. EventSub WS fires `channel.subscribe`
2. `apps/twitch` writes to `events` table (raw)
3. Normalizer writes to `actions` outbox table
4. `apps/discord` polling worker picks up action `roles.sync`
5. Looks up Discord user via `accounts` (Better-Auth) link
6. `GuildMember.roles.add(roleId)` per role map setting
7. Audit log row + Realtime broadcast

### Scheduled timer

1. `pg_cron` runs every minute
2. SQL fetches timers where `next_fire_at <= now()`
3. For each, SQL enqueues `pgmq` job `timer.fire {id, channel}`
4. `apps/twitch` worker pops, validates min-chat-lines, posts message
5. Updates `last_fired_at`, computes new `next_fire_at`

## Critical invariants

- Every staff action → `audit_logs` row. Append-only (DB trigger blocks UPDATE/DELETE).
- Every external secret → AES-256-GCM encrypted column. Master key from env at boot.
- Every job → idempotency key. Retries are safe.
- Every Twitch token → refresh handler. Rotation on expiry, audit on rotation.
- Every Discord interaction → defer if longer than 2.5s expected.

## Migrations

- Drizzle Kit generates SQL migrations under `packages/db/migrations/`
- CI runs `drizzle-kit migrate --dry-run` on every PR
- Apply on deploy: `bun --filter=db migrate`
- Never edit existing migration files. Always write a new one.
