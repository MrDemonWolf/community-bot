# Community Bot — Feature Summary

Everything the bot can do, at a glance.

---

## Twitch Bot — Chat Commands

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!ping` | Check if the bot is alive | Everyone |
| `!uptime` | How long the stream has been live | Everyone |
| `!accountage [user]` | How old a Twitch account is | Everyone |
| `!title` | Current stream title | Everyone |
| `!game` | Current game/category | Everyone |
| `!followage` | How long you've followed the channel | Everyone |
| `!vanish` | Clear your own chat messages | Everyone |
| `!clip` | Create a Twitch clip | Everyone |
| `!commands` | Link to the public commands page | Everyone |

## Twitch Bot — Song Requests

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!sr <song>` | Request a song | Everyone |
| `!sr list` | See next 5 songs in queue | Everyone |
| `!sr current` | Currently playing song | Everyone |
| `!sr remove` | Remove your own requests | Everyone |
| `!sr skip` | Skip the current song | Mod+ |
| `!sr remove <position>` | Remove a specific song | Mod+ |
| `!sr clear` | Clear the entire queue | Mod+ |

## Twitch Bot — Viewer Queue

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!queue join` | Join the viewer queue | Everyone |
| `!queue leave` | Leave the queue | Everyone |
| `!queue list` | See the queue (up to 10) | Everyone |
| `!queue position` | Check your spot | Everyone |
| `!queue open` / `close` | Open or close the queue | Mod+ |
| `!queue pause` / `unpause` | Pause or resume the queue | Mod+ |
| `!queue pick [random/user]` | Pick next, random, or specific viewer | Mod+ |
| `!queue remove <user>` | Remove a viewer | Mod+ |
| `!queue clear` | Clear the entire queue | Mod+ |

## Twitch Bot — Quotes

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!quote` | Show a random quote | Everyone |
| `!quote <number>` | Show a specific quote | Everyone |
| `!quote search <text>` | Search quotes by keyword | Everyone |
| `!quote add <text>` | Add a new quote | Mod+ |
| `!quote remove <number>` | Remove a quote | Mod+ |

## Twitch Bot — Counters

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!counter <name>` | Show a counter's value | Mod+ |
| `!counter <name> +` / `-` | Increment or decrement | Mod+ |
| `!counter <name> set <value>` | Set to an exact value | Mod+ |
| `!counter <name> create` | Create a new counter | Mod+ |
| `!counter <name> delete` | Delete a counter | Mod+ |

## Twitch Bot — Command Management (Mod+)

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!command add <name> <response>` | Create a custom command | Mod+ |
| `!command edit <name> <response>` | Edit a command's response | Mod+ |
| `!command remove <name>` | Delete a command | Mod+ |
| `!command show <name>` | Show a command's settings | Mod+ |
| `!command options <name> <flags>` | Modify cooldown, access level, aliases, etc. | Mod+ |

## Twitch Bot — Moderation

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!bot mute` / `unmute` | Mute or unmute the bot | Mod+ |
| `!permit <user> [seconds]` | Temporarily bypass spam filters | Mod+ |
| `!nuke <phrase> [seconds]` | Timeout users who said a phrase | Mod+ |
| `!shoutout <user>` | Shout out another streamer | Mod+ |
| `!reloadcommands` | Force-reload commands from DB | Broadcaster |

## Twitch Bot — Giveaways

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!giveaway start <keyword> [title]` | Start a keyword giveaway | Mod+ |
| `!giveaway draw` | Randomly pick a winner | Mod+ |
| `!giveaway reroll` | Pick a new winner | Mod+ |
| `!giveaway end` | End the giveaway | Mod+ |
| `!giveaway count` | Show entry count | Mod+ |
| *(type the keyword)* | Enter the giveaway | Everyone |

## Twitch Bot — Polls

| Command | What it does | Who can use it |
|---------|-------------|----------------|
| `!poll create "Q" "O1" "O2" [dur]` | Create a Twitch-native poll | Mod+ |
| `!poll end` | End the poll early | Mod+ |
| `!poll results` | Show current results | Mod+ |

## Twitch Bot — Broadcaster Only

| Command | What it does |
|---------|-------------|
| `!filesay <url>` | Read a text file and send each line to chat |

## Twitch Bot — Other Features

| Feature | Description |
|---------|-------------|
| Custom commands | Database-driven with variables, cooldowns, access levels, regex triggers, aliases |
| Response variables | `{user}`, `{channel}`, `{counter name}`, `{game}`, `{title}`, and more |
| Recurring timers | Scheduled chat messages at configurable intervals |
| Spam filters | Caps, links, symbols, emotes, repetition, banned words (each toggleable) |
| AI shoutouts | Google Gemini-powered personalized shoutout messages (optional) |
| Stream status tracking | Commands can be filtered to online-only or offline-only |
| Auto-reload | Commands and regulars refresh every 5 min + instant EventBus updates |
| Access levels | Everyone, Subscriber, Regular, VIP, Moderator, Lead Moderator, Broadcaster |

---

## Discord Bot — Slash Commands

| Command | What it does |
|---------|-------------|
| `/twitch add <username>` | Monitor a Twitch channel for live notifications |
| `/twitch remove <username>` | Stop monitoring a channel |
| `/twitch list` | Show all monitored channels |
| `/twitch test <username>` | Send a test notification (owner only) |
| `/twitch notifications set-channel` | Set the notification channel |
| `/twitch notifications set-role` | Set the role to ping on go-live |
| `/quote show [number]` | Show a random or specific quote |
| `/quote add <text>` | Add a quote |
| `/quote remove <number>` | Remove a quote |
| `/quote search <text>` | Search quotes by keyword |

## Discord Bot — Other Features

| Feature | Description |
|---------|-------------|
| Twitch live notifications | Rich embeds when monitored channels go live/offline |
| Configurable role mapping | Map Discord roles to admin/mod permissions (falls back to Discord permissions) |
| Welcome & leave messages | Configurable messages when members join/leave |
| Auto-role | Assign a role to new members automatically |
| DM welcome | Send a private welcome message to new members |
| Guild sync | Auto-sync guild data to DB on join/leave |
| Real-time config | Dashboard changes apply instantly via EventBus |

---

## Web Dashboard — Main

| Feature | Description |
|---------|-------------|
| Audit log feed | Real-time log of all changes with user avatars and timestamps |
| Bot controls | Enable/disable/mute the Twitch bot |
| Quick stats | Commands, regulars, queue, bot status, quotes, counters, timers, song requests, giveaways (auto-refresh 30s) |

## Web Dashboard — Twitch Management

| Page | What you can do |
|------|----------------|
| Commands | Create, edit, delete, toggle custom commands + configure default command toggles and access levels |
| Regulars | Manage trusted users |
| Queue | Open/close/pause, pick viewers, manage entries |
| Quotes | View, add, remove quotes (shared with Discord) |
| Counters | Create, edit, delete named counters |
| Timers | Create, edit, toggle recurring chat timers |
| Song Requests | View queue, skip/remove songs, configure settings |
| Moderation | Configure spam filters (caps, links, symbols, emotes, repetition, banned words) |
| Giveaways | Create giveaways, draw winners, view entries and history |
| Polls | Create Twitch-native polls, view results and history |

## Web Dashboard — Discord Management

| Page | What you can do |
|------|----------------|
| Discord Settings | Link a Discord server, set notification channel/role, enable/disable |
| Welcome & Leave | Configure welcome messages, leave messages, auto-role, DM welcomes |

## Web Dashboard — Admin

| Page | What you can do |
|------|----------------|
| User Management | Manage roles, ban/unban users (broadcaster only) |
| Settings | Profile, AI shoutout toggle, data export/import |

## Web Dashboard — Public Pages (no login needed)

| Path | What it shows |
|------|--------------|
| `/p` | Broadcaster profile with stream status, commands preview, queue, song requests, quotes |
| `/p/commands` | All enabled chat commands |
| `/p/queue` | Current viewer queue |
| `/p/quotes` | Browse all quotes with game tags |
| `/p/song-requests` | Current song request queue |

---

## Infrastructure

| Component | Description |
|-----------|-------------|
| Monorepo | Turborepo with shared packages (DB, env, events, auth, API, server) |
| Database | PostgreSQL via Prisma (shared schema across all services) |
| Redis | EventBus pub/sub + BullMQ job queue |
| Auth | Discord + Twitch OAuth via better-auth |
| Role hierarchy | User < Moderator < Lead Moderator < Broadcaster (Admin) |
| Setup wizard | First-user setup flow with one-time token |
| Docker | docker-compose with PostgreSQL, Redis, and all services |
| Health checks | `/health` endpoints on all services |
| Tests | 657 unit tests across 66 files + ~95 integration tests |
