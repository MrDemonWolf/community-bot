# Community Bot — Discord

The Discord bot for Community Bot. Built with [discord.js](https://discord.js.org/) v14, Express, BullMQ, and Prisma. Features moderation with case tracking, self-assignable role panels, message templates, scheduled messages, custom commands, user reports, event logging, Twitch live notifications, and cross-platform quotes — all via slash commands.

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/help` | Contextual help for any command group | Public |
| `/mod` | Ban, tempban, kick, warn, mute, unban, unmute, unwarn | Mod |
| `/case` | Look up, list, search, and annotate moderation cases | Mod |
| `/config` | Configure log channels and warning escalation thresholds | Admin |
| `/roles` | Create and manage self-assignable role panels | Admin |
| `/template` | Create reusable message templates with variables | Admin |
| `/schedule` | Set up one-time or recurring scheduled messages | Admin |
| `/cc` | Create and run custom slash commands | Mod/Public |
| `/report` | Report users and manage report status | Public/Mod |
| `/data` | Export or delete your personal data | Public |
| `/twitch` | Manage Twitch live stream notifications | Admin |
| `/quote` | View, add, remove, and search quotes | Public/Mod |

## Development

This app is part of the Community Bot monorepo. All commands should be run from the monorepo root.

### Setup

```bash
# From monorepo root
bun install
docker compose up -d postgres redis
bun db:push
bun dev
```

### Environment

Discord bot environment variables are validated in `packages/env/src/discord.ts`. Required variables include `DISCORD_APPLICATION_ID`, `DISCORD_APPLICATION_BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`, and others. See the monorepo `.env.example` for the full list.

### Project Structure

```
src/
  app.ts                        # Entry point — Discord client, BullMQ, Express, EventBus
  commands/
    index.ts                    # Slash command registry
    case/                       # /case — case management
    config/                     # /config — log channels & thresholds
    customcommand/              # /cc — custom commands
    data/                       # /data — data export/delete
    help/                       # /help — contextual help
    mod/                        # /mod — moderation actions
    quote/                      # /quote — cross-platform quotes
    report/                     # /report — user reports
    roles/                      # /roles — role panels
    schedule/                   # /schedule — scheduled messages
    template/                   # /template — message templates
    twitch/                     # /twitch — Twitch notifications
  events/
    interactionCreate.ts        # Routes commands, buttons, select menus, autocomplete
    buttonHandler.ts            # Role panel button interactions
    selectMenuHandler.ts        # Role panel select menu interactions
    autocomplete.ts             # Autocomplete for template/schedule/panel names
    ready.ts                    # Guild sync, slash command registration
    guildCreate.ts / guildDelete.ts
  utils/
    permissions.ts              # Role-based permission checks (admin/mod)
    pagination.ts               # Paginated embed utility
    eventLogger.ts              # Log dispatch with TTL-cached config
    logEmbeds.ts                # Embed builders for event types
    cronParser.ts               # Cron expression utilities
  worker/
    index.ts                    # BullMQ worker
    jobs/
      setActivity.ts            # Rotating bot activity
      checkTwitchStreams.ts      # Stream polling (90s)
      sendScheduledMessage.ts   # Scheduled message delivery
  twitch/
    api.ts                      # Twitch Helix API wrapper
    embeds.ts                   # Live/offline notification embeds
```

## License

See the monorepo root [LICENSE](../../LICENSE) file.
