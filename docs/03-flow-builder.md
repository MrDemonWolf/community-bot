# 03 — Flow builder

The KILLER feature. Visual node editor for triggers → conditions → actions. Lets Nathanial wire up Brain Cells redeems and other custom flows without writing code.

Two-phase rollout:

- **Phase 5A — Declarative:** safe nodes only (no custom JS). Triggers, conditions, actions from a fixed catalog. Stored as JSON, executed deterministically.
- **Phase 5B — Sandbox:** add a "Custom JS" node that runs in QuickJS WASM with strict limits.

## Library choice: `@xyflow/react` v12

Why: best React Flow library. TypeScript-first. Active maintenance. Huge community. Built-in drag/drop, mini-map, controls.

Install:

```bash
bun add @xyflow/react
```

## Node taxonomy

### Triggers (sources, 1 per flow)

- `trigger.chat-command` — `!cmd` typed in Twitch chat
- `trigger.channel-points-redeem` — channel point redemption (Twitch EventSub)
- `trigger.event-stream-online` — stream went online
- `trigger.event-stream-offline` — stream went offline
- `trigger.event-sub` — new subscriber
- `trigger.event-cheer` — bits cheered
- `trigger.event-gift-sub` — gifted sub
- `trigger.event-raid` — incoming raid
- `trigger.event-follow` — new follower (note: spammable, requires anti-bot)
- `trigger.timer` — every N seconds / cron
- `trigger.keyword` — passive match on chat (regex or word list)
- `trigger.discord-slash` — Discord slash command
- `trigger.discord-message` — Discord message in configured channel
- `trigger.webhook` — incoming HTTPS POST with secret

### Conditions (filters / branches)

- `cond.role` — user role >= X
- `cond.user-counter` — user counter X is >/= N
- `cond.counter` — global counter X is >/= N
- `cond.random-chance` — N% pass through
- `cond.cooldown` — block if last fired within N seconds
- `cond.time-of-day` — between HH:MM and HH:MM in streamer TZ
- `cond.if-else` — generic expression evaluator (Phase 5A: limited DSL; Phase 5B: full JS)

### Actions

- `action.chat-reply` — post in Twitch chat
- `action.discord-message` — post in Discord channel
- `action.update-counter` — increment/decrement counter
- `action.update-user-counter` — for per-user (Brain Cells)
- `action.give-points` — add to a user's Brain Cell balance
- `action.add-discord-role` — add a Discord role to user
- `action.remove-discord-role` — remove a Discord role from user
- `action.timeout-user` — Twitch timeout
- `action.delete-message` — delete last N seconds of user's messages (Phase 3)
- `action.set-twitch-title` — Helix modify channel info
- `action.set-twitch-game` — Helix modify channel info
- `action.webhook-out` — POST to a URL
- `action.custom-js` — runs in QuickJS sandbox (Phase 5B only)

## Execution

- Graph stored as JSON in `flows` table (`schema.flows`)
- On trigger fire: load matching flows, execute breadth-first
- Each node returns `{ pass: boolean, vars: Record<string,unknown> }` to next node
- Timeout per node: 2s (Phase 5A) or 200ms (Phase 5B custom JS)
- Memory limit per JS execution: 16 MB (Phase 5B)
- Trace logged to `flow_traces` table for debugging in dashboard

## Brain Cells redeem flow (the canonical example)

```
trigger.channel-points-redeem (reward: "Collect a Brain Cell")
  → cond.cooldown (user, 12 hours)
  → action.update-user-counter (brain_cells, +1)
  → action.chat-reply ("@${user} now has ${user.brain_cells} brain cells 🧠🐺")
```

Built in the visual editor, published, fires on next redeem. No code.

## Editor UI (apps/web/src/routes/dashboard/flows/)

- Left panel: node palette grouped by trigger/condition/action
- Center: canvas with current flow
- Right panel: selected node config (form generated from Zod schema)
- Top bar: name, status (draft/published), test-fire button, save
- Bottom: live execution trace (when in test mode)

Mobile: editor is desktop-first; mobile shows read-only list of flows + enable/disable toggles.

## Schema

```ts
export const flows = pgTable('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(false),
  graph: jsonb('graph').notNull(),    // { nodes: Node[], edges: Edge[] }
  triggerType: text('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').notNull(),
  version: integer('version').notNull().default(1),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  fireCount: integer('fire_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').references(() => user.id),
});

export const flowTraces = pgTable('flow_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }),
  firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
  triggerPayload: jsonb('trigger_payload'),
  steps: jsonb('steps').notNull(),    // array of { nodeId, pass, vars, durationMs, error? }
  totalDurationMs: integer('total_duration_ms'),
  outcome: text('outcome').notNull(), // 'completed' | 'short-circuited' | 'error'
});
```

## QuickJS sandbox (Phase 5B)

Library: `quickjs-emscripten`

Per-call limits:

- 200ms execution timeout
- 16 MB memory cap
- No fetch, no fs, no eval-of-strings-from-globals
- Whitelisted host functions: `console.log` (captured), `Math`, `Date`, `JSON`, and a curated `bot.*` API for actions

Host API surface (initial):

```ts
bot.user           // { id, name, role, brainCells }
bot.event          // current trigger payload
bot.counter.get(name): number
bot.counter.set(name, value): void
bot.counter.inc(name, delta?): number
bot.userCounter.get(name): number
bot.userCounter.inc(name, delta?): number
bot.reply(message: string): void  // chat reply via outbox
bot.discord.message(channelId, content: string): void
bot.fetch(url: string, init?): Promise<...>  // domain-allowlist only
```

Custom-JS nodes are disabled by default per flow. Broadcaster must toggle "Enable custom JS" on the flow itself, and only the broadcaster can publish a flow with a custom-JS node.
