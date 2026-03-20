# @community-bot/db

Shared [Drizzle ORM](https://orm.drizzle.team/) schema, client, and type exports for the Community Bot monorepo. This package is the single source of truth for the database schema.

## Exports

- **`db`** — Configured Drizzle client (postgres.js driver)
- **Tables** — All Drizzle table definitions from `src/schema/`
- **Enum value objects** — `TwitchAccessLevel`, `TwitchResponseType`, `TwitchStreamStatus`, `QueueStatus`, `UserRole`, `DiscordCaseType`, `DiscordReportStatus`, `DiscordScheduleType`
- **Type aliases** — Union types for each enum (e.g., `type TwitchAccessLevel = "EVERYONE" | "SUBSCRIBER" | ...`)
- **Drizzle utilities** — Re-exported `eq`, `and`, `or`, `sql`, `count`, etc.

## Usage

```typescript
import { db, eq, botChannels, TwitchAccessLevel } from "@community-bot/db";

const channel = await db.query.botChannels.findFirst({
  where: eq(botChannels.userId, userId),
});
```

## Commands

Run from the monorepo root:

```bash
bun db:push       # Push schema changes to the database
bun db:migrate    # Run database migrations
bun db:studio     # Open Drizzle Studio GUI
```

## License

See the monorepo root [LICENSE](../../LICENSE) file.
