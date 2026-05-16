# 02 — Database

Drizzle schemas in `packages/db/src/schema/`. One file per concern.

## Schema split (Phase -1 baseline)

```
packages/db/src/schema/
├── auth.ts        # Better-Auth tables (user, session, account, verification)
├── settings.ts    # Global key-value settings + JSON config blobs
├── audit.ts       # Append-only audit log
├── userMeta.ts    # Per-user metadata (loyalty, opt-outs, etc.)
├── commands.ts    # Custom chat commands
├── timers.ts      # Scheduled messages
├── quotes.ts      # Quotes table (Phase 3)
├── counters.ts    # Counters + per-user counters (Phase 3)
├── events.ts      # Raw Twitch/Discord events (immutable)
├── actions.ts     # Outbox table (normalized actions to perform)
├── flows.ts       # Flow graphs (Phase 5A)
├── plugins.ts     # Installed plugin registry (Phase 3+)
├── twitchTokens.ts # Encrypted Twitch OAuth tokens
├── discordTokens.ts # Encrypted Discord bot tokens
└── index.ts       # re-export everything
```

## Roles enum

```ts
export const role = pgEnum('role', [
  'broadcaster',
  'editor',
  'moderator',
  'vip',
  'subscriber',
  'viewer'
]);
```

Stored on `user.role`. Exactly one `broadcaster`, enforced via partial unique index:

```sql
CREATE UNIQUE INDEX one_broadcaster ON "user" (role) WHERE role = 'broadcaster';
```

## userMeta

```ts
export const userMeta = pgTable('user_meta', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  brainCells: integer('brain_cells').notNull().default(0),
  watchMinutes: integer('watch_minutes').notNull().default(0),
  followedAt: timestamp('followed_at', { withTimezone: true }),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  aiOptOut: boolean('ai_opt_out').notNull().default(false),
  exportRequestedAt: timestamp('export_requested_at', { withTimezone: true }),
  forgetMeAt: timestamp('forget_me_at', { withTimezone: true }),
  notes: text('notes'),
});
```

## commands

```ts
export const commands = pgTable('commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  response: text('response').notNull(),                // template string
  responsePlatform: jsonb('response_platform'),         // optional per-platform override { twitch: '...', discord: '...' }
  cooldownSec: integer('cooldown_sec').notNull().default(5),
  userCooldownSec: integer('user_cooldown_sec').notNull().default(0),
  minRole: role('min_role').notNull().default('viewer'),
  enabled: boolean('enabled').notNull().default(true),
  hidden: boolean('hidden').notNull().default(false),   // hide from public /commands page
  platform: jsonb('platform').notNull().default(sql`'{"twitch":true,"discord":false}'::jsonb`),
  category: text('category'),                           // 'info' | 'mod' | 'fun' | 'loyalty' | 'meta'
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').references(() => user.id),
});
```

Index: `(name)`, `(enabled, hidden) WHERE NOT hidden` (for public page).

## timers

```ts
export const timers = pgTable('timers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  messages: text('messages').array().notNull(),        // rotates through
  intervalSec: integer('interval_sec').notNull(),
  minChatLines: integer('min_chat_lines').notNull().default(5),
  rotation: text('rotation').notNull().default('round-robin'), // 'random' | 'round-robin'
  platform: jsonb('platform').notNull().default(sql`'{"twitch":true,"discord":false}'::jsonb`),
  enabled: boolean('enabled').notNull().default(true),
  rotationIndex: integer('rotation_index').notNull().default(0),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  nextFireAt: timestamp('next_fire_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

## auditLogs (append-only)

```ts
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actorId: text('actor_id').references(() => user.id),
  actorRole: role('actor_role'),
  action: text('action').notNull(),                    // 'command.create' | 'mod.ban' | 'flow.publish' etc.
  targetType: text('target_type'),
  targetId: text('target_id'),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  correlationId: text('correlation_id'),
  ipHash: text('ip_hash'),                              // SHA256(ip + salt) — not raw IP
});
```

Migration includes a trigger that blocks `UPDATE` and `DELETE`. Append-only is enforced at the DB layer.

## Template engine — variables

Implemented in `packages/shared/src/template/`. Tokens look like `${name}` or `${name.arg.arg}`.

Match StreamElements parity where reasonable. Full list in `docs/04-import-wizard.md`. Highlights:

- User context: `${user}`, `${touser}`, `${user.id}`, `${user.role}`, `${user.subTier}`
- Stream: `${uptime}`, `${game}`, `${title}`, `${viewers}`, `${followers}`
- Random: `${random.N.M}`, `${random.choice.a.b.c}`, `${random.user}`
- Loyalty: `${user.brain_cells}`, `${count}`, `${count.name}`
- Time: `${followage}`, `${accountage}`, `${time.format}` (uses streamer's TZ)
- Args: `${1}`, `${2}`, `${@}` (all args)
- URL fetch: `${url.http://...}` (Phase 3+ via plugin only; sandboxed)

Variable resolvers live in `packages/shared/src/variables/` — one resolver per category. Twitch/Helix resolvers in `apps/twitch` (workers) since they need API client.

## pgmq queues

Naming convention: `<domain>.<job>` (e.g. `roles.sync`, `timers.fire`, `imports.streamelements`, `ai.shoutout`).

Each queue gets:

- A `messages` table (auto-created by pgmq)
- A retry policy in `packages/jobs/queues.ts`
- A DLQ (dead-letter queue) for permanent failures
- A worker class extending `Worker<PayloadType>` from `packages/jobs/`

## pg_cron schedules

Naming: `cron.<name>`. Defined as SQL migrations.

Examples:

- `cron.timer-tick` (every 1 min) — enqueues `timers.fire` jobs for due timers
- `cron.purge-events` (daily) — deletes `events` older than `settings.retention.eventsDays`
- `cron.token-refresh-check` (every 15 min) — enqueues token refresh jobs

## Realtime channels

Naming: `<scope>.<event>` (e.g. `dashboard.commands`, `chat.live`, `stream.state`).

Broadcasts are ephemeral. The dashboard subscribes via `@supabase/supabase-js` realtime.

## Migrations

```
packages/db/migrations/
├── 0000_initial.sql       # roles, user_meta, audit_logs, settings
├── 0001_commands.sql
├── 0002_timers.sql
├── 0003_pgmq_init.sql     # CREATE EXTENSION pgmq
├── 0004_pgcron_init.sql   # CREATE EXTENSION pg_cron
└── 0005_audit_immutable.sql # trigger blocking UPDATE/DELETE on audit_logs
```

Drizzle Kit generates each. Hand-written SQL goes in `packages/db/sql/` and is referenced from a Drizzle migration via `sql.raw(readFileSync(...))`.
