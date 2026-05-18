# 04 — Import wizard

`apps/web` route: `/dashboard/import`. Phase 7.

## Sources supported

1. **StreamElements** (primary — Nathanial's bot)
2. **Nightbot**
3. **Fossabot**

Each importer is a separate module under `apps/server/src/import/<source>/`:

- `parser.ts` — accepts raw JSON, returns normalized intermediate
- `mapper.ts` — maps intermediate → our schema (commands, timers, counters)
- `compat.ts` — flags variables/features that don't map cleanly

## SE — how Nathanial gets his export

(Documented step-by-step in `docs/streamelements-export.md` — see appendix.)

Two paths:

- **JWT path:** paste your SE JWT (from `localStorage.user.jwt` in DevTools while logged in) → bot calls `GET /kappa/v2/bot/commands/:channelId` directly
- **JSON paste path:** paste exported JSON from SE dashboard or copied from network tab

Both end at the same parser.

## Nightbot

OAuth flow via `https://api.nightbot.tv/oauth2/authorize`. Scopes: `commands` `timers` `regulars`. After OAuth:

- `GET /1/commands` → commands
- `GET /1/timers` → timers
- `GET /1/regulars` → regulars (mapped to `vip` role)

## Fossabot

No public management API. Manual JSON paste only. Document where in their dashboard the user finds the export.

## Variable compat matrix

| SE variable       | Nightbot          | Fossabot          | community-bot           | Notes                     |
| ----------------- | ----------------- | ----------------- | ----------------------- | ------------------------- |
| `${user}`         | `$(user)`         | `${user}`         | `${user}`               | Sender display name       |
| `${touser}`       | `$(touser)`       | `${touser}`       | `${touser}`             | Argument after command    |
| `${1}`, `${2}`    | `$(1)`, `$(2)`    | `${1}`, `${2}`    | `${1}`, `${2}`          | Positional args           |
| `${random.1.100}` | `$(random.1.100)` | `${random.1.100}` | `${random.1.100}`       | Random N..M               |
| `${customapi}`    | `$(customapi)`    | —                 | `${url.<url>}`          | Phase 3+, sandboxed       |
| `${urlfetch}`     | `$(urlfetch)`     | `${url.<url>}`    | `${url.<url>}`          | Same                      |
| `${count}`        | `$(count)`        | `${count}`        | `${count.<name>}`       | Counter, named            |
| `${chatters}`     | —                 | `${chatters}`     | `${chatters}`           | Helix-backed              |
| `${uptime}`       | `$(uptime)`       | `${uptime}`       | `${uptime}`             | Helix-backed              |
| `${user.points}`  | `$(user.points)`  | `${user.points}`  | `${user.brain_cells}`   | Loyalty currency          |
| `${followage}`    | `$(followage)`    | `${followage}`    | `${followage}`          | Helix-backed              |
| `${twitch}`       | `$(twitch)`       | —                 | `${twitch}`             | Streamer display          |
| `${weather}`      | —                 | `${weather}`      | `${weather.<location>}` | WeatherKit Phase 2+       |
| `${lasttweet}`    | —                 | —                 | UNSUPPORTED             | X API explicitly disabled |

After import: any command containing `${lasttweet}` is imported with `enabled: false` and a warning in the compat report.

## Dry-run preview

Before any write, the importer renders a diff:

- N commands found
- M would create (no existing name match)
- K would update (name matches existing)
- J would skip (rule below)
- Variables that need attention: list

User picks per-command: keep / overwrite / merge / skip.

## Collision strategies

Per-row, with bulk apply:

- **Skip** — don't touch existing
- **Overwrite** — replace existing values
- **Merge** — merge metadata, keep existing response

## Idempotency

Each import gets a UUID `importId`. All created rows tagged with `importId` in metadata. Re-running same export → no new rows (matched by `importId` + source name).

## Schema for import tracking

```ts
export const imports = pgTable("imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(), // 'streamelements' | 'nightbot' | 'fossabot'
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdCount: integer("created_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  compatReport: jsonb("compat_report"),
  rawPayload: text("raw_payload"), // encrypted (might contain JWTs)
  initiatedBy: text("initiated_by").references(() => user.id),
});
```
