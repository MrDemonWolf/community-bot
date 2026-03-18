# Community Bot — Twitch

The Twitch chat bot for Community Bot. Built with [@twurple/chat](https://twurple.js.org/) v7, Express, and Prisma. Features 22 built-in commands, database-driven custom commands with variables/cooldowns/access levels, viewer queue, song requests, giveaways, polls, spam filters, counters, timers, quotes, and AI-enhanced shoutouts.

## Built-in Commands

| Command | Access | Description |
|---------|--------|-------------|
| `!ping` | Everyone | Check if the bot is alive |
| `!uptime` | Everyone | Stream uptime or offline duration |
| `!accountage` | Everyone | Twitch account creation date |
| `!title` | Everyone | Current stream title |
| `!game` | Everyone | Current game/category |
| `!followage` | Everyone | How long you've followed the channel |
| `!vanish` | Everyone | Clear your own chat messages |
| `!clip` | Everyone | Create a Twitch clip |
| `!commands` | Everyone | Link to the public commands page |
| `!bot` | Broadcaster | Mute/unmute the bot |
| `!command` | Mod+ | Manage custom commands from chat |
| `!reloadcommands` | Mod+ | Reload commands and regulars from DB |
| `!filesay` | Broadcaster | Send lines from a URL to chat |
| `!quote` | Everyone/Mod+ | View, add, remove, search quotes |
| `!counter` | Mod+ | Named counters with increment/decrement/set |
| `!permit` | Mod+ | Temporarily bypass spam filters |
| `!nuke` | Mod+ | Timeout users who said a phrase |
| `!shoutout` / `!so` | Mod+ | Shout out a streamer (supports AI-enhanced) |
| `!sr` | Everyone/Mod+ | Song request system (YouTube) |
| `!queue` | Everyone/Mod+ | Viewer queue system |
| `!giveaway` | Mod+ | Keyword giveaway system |
| `!poll` | Mod+ | Create Twitch-native polls |

## Key Features

- **Custom commands** — Database-driven with 30+ variables, cooldowns, access levels, regex triggers, aliases, and stream-aware filtering
- **Spam filters** — Caps, links, symbols, emotes, repetition, banned words (each individually toggleable)
- **Song requests** — YouTube URL/search with queue limits, duration limits, backup playlists, and browser source overlay
- **Giveaways** — Keyword entry with duplicate prevention, winner draw, reroll, and dashboard history
- **Polls** — Twitch-native polls with chat commands
- **Timers** — Recurring scheduled messages with min chat lines threshold
- **AI shoutouts** — Google Gemini-powered personalized shoutout messages (optional)
- **7-tier access levels** — Everyone, Subscriber, Regular, VIP, Moderator, Lead Moderator, Broadcaster

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

On first run, the bot starts the Twitch Device Code Flow — it prints a link to your terminal, you authorize in your browser, and the bot saves the tokens automatically.

### Environment

Twitch bot environment variables are validated in `packages/env/src/twitch.ts`. Required variables include `TWITCH_APPLICATION_CLIENT_ID`, `TWITCH_APPLICATION_CLIENT_SECRET`, `TWITCH_CHANNEL`, `DATABASE_URL`, `REDIS_URL`, and others. See the monorepo `.env.example` for the full list.

### Project Structure

```
src/
  app.ts                    # Entry point — chat client, Express, EventBus
  commands/                 # 22 built-in command handlers
  events/                   # Twitch event handlers (message, join, part)
  services/                 # Business logic (command cache, access control,
                            #   cooldowns, executor, stream status, queue,
                            #   song requests, giveaways, polls, spam filters)
  twitch/                   # Auth (RefreshingAuthProvider, Device Code Flow)
  utils/                    # Env validation, logging helpers
```

## License

See the monorepo root [LICENSE](../../LICENSE) file.
