# Community Bot — Feature Summary

Everything the bot can do, at a glance.

---

## Twitch Bot (22 built-in commands)

### Chat Commands (everyone)
- `!ping` — Check if the bot is alive
- `!uptime` — How long the stream has been live
- `!accountage [user]` — How old a Twitch account is (aliases: `!accage`, `!created`)
- `!title` — Current stream title
- `!game` — Current game/category
- `!followage` — How long you've followed the channel
- `!vanish` — Clear your own chat messages
- `!clip` — Create a Twitch clip
- `!commands` — Link to the public commands page

### Song Requests (everyone)
- `!sr <song>` — Request a song (aliases: `!songrequest`, `!song`)
- `!sr list` / `!sr queue` — See next 5 songs
- `!sr current` — Currently playing song
- `!sr remove` — Remove your own requests

### Queue (everyone)
- `!queue join` / `!queue leave` — Join or leave the viewer queue
- `!queue list` — See the queue (up to 10)
- `!queue position` — Check your spot

### Quotes (everyone can view, mods can add/remove)
- `!quote` — Random quote
- `!quote <number>` — Specific quote
- `!quote search <text>` — Search quotes
- `!quote add <text>` — Add a quote (mod+)
- `!quote remove <number>` — Remove a quote (mod+)

### Counters (mod+)
- `!counter <name>` — Show a counter value
- `!counter <name> +` / `-` — Increment or decrement
- `!counter <name> set <value>` — Set to exact value
- `!counter <name> create` / `delete` — Create or delete

### Moderation (mod+)
- `!bot mute` / `!bot unmute` — Mute/unmute the bot
- `!permit <user> [seconds]` — Temporarily bypass spam filters
- `!nuke <phrase> [seconds]` — Timeout all recent users who said a phrase
- `!shoutout <user>` — Shout out another streamer (alias: `!so`)
- `!reloadcommands` — Force-reload commands from DB

### Song Request Management (mod+)
- `!sr skip` — Skip current song
- `!sr remove <position>` — Remove a specific song
- `!sr clear` — Clear the queue

### Queue Management (mod+)
- `!queue open` / `close` / `pause` / `unpause`
- `!queue pick` / `pick random` / `pick <user>`
- `!queue remove <user>` / `clear`

### Giveaways (mod+)
- `!giveaway start <keyword> [title]` — Start a keyword giveaway (alias: `!ga`)
- `!giveaway draw` / `reroll` — Pick a winner
- `!giveaway end` — End the giveaway
- `!giveaway count` — Show entry count
- Viewers enter by typing the keyword in chat

### Polls (mod+)
- `!poll create "Question" "Opt1" "Opt2" [duration]` — Create a Twitch-native poll
- `!poll end` — End poll early
- `!poll results` — Show current results

### Broadcaster Only
- `!filesay <url>` — Read a text file and send each line to chat
- `!command add/edit/remove/show/options` — Full command management from chat

### Other Twitch Features
- **Custom commands** — Database-driven with variables, cooldowns, access levels, regex triggers, aliases
- **Response variables** — `{user}`, `{channel}`, `{counter <name>}`, `{game}`, `{title}`, etc.
- **Recurring timers** — Scheduled messages at configurable intervals
- **Spam filters** — Caps, links, symbols, emotes, repetition, banned words (each toggleable)
- **AI shoutouts** — Google Gemini-powered personalized shoutout messages (optional)
- **Stream status tracking** — Online/offline command filtering
- **Auto-reload** — Commands and regulars refresh every 5 minutes + instant EventBus updates
- **Access levels** — Everyone, Subscriber, Regular, VIP, Moderator, Lead Moderator, Broadcaster

---

## Discord Bot

### Slash Commands
- `/twitch add <username>` — Monitor a Twitch channel for live notifications
- `/twitch remove <username>` — Stop monitoring a channel
- `/twitch list` — Show all monitored channels
- `/twitch test <username>` — Send a test notification (owner only)
- `/twitch notifications set-channel <channel>` — Set the notification channel
- `/twitch notifications set-role <role>` — Set the role to ping on go-live
- `/quote show [number]` — Show a random or specific quote
- `/quote add <text>` — Add a quote
- `/quote remove <number>` — Remove a quote
- `/quote search <text>` — Search quotes

### Other Discord Features
- **Twitch live notifications** — Rich embeds when monitored channels go live/offline
- **Welcome & leave messages** — Configurable messages when members join/leave
- **Auto-role** — Assign a role to new members automatically
- **DM welcome** — Send a private welcome to new members
- **Guild sync** — Auto-sync guild data to DB on join/leave
- **Real-time config** — Dashboard changes apply instantly via EventBus

---

## Web Dashboard

### Main Dashboard
- **Audit log feed** — Real-time log of all changes with user avatars and timestamps
- **Bot controls** — Enable/disable/mute the Twitch bot
- **Quick stats** — Commands, regulars, queue, bot status, quotes, counters, timers, song requests, giveaways (auto-refresh every 30s)

### Twitch Management Pages
- **Commands** — Create, edit, delete, toggle custom commands + configure default command toggles and access levels
- **Regulars** — Manage trusted users
- **Queue** — Open/close/pause, pick viewers, manage entries
- **Quotes** — View, add, remove quotes (shared with Discord)
- **Counters** — Create, edit, delete named counters
- **Timers** — Create, edit, toggle recurring chat timers
- **Song Requests** — View queue, skip/remove songs, configure settings
- **Moderation** — Configure spam filters (caps, links, symbols, emotes, repetition, banned words)
- **Giveaways** — Create giveaways, draw winners, view entries and history
- **Polls** — Create Twitch-native polls, view results and history

### Discord Management
- **Discord Settings** — Link a Discord server, set notification channel/role, enable/disable
- **Welcome & Leave** — Configure welcome messages, leave messages, auto-role, DM welcomes

### Admin
- **User Management** — Manage roles, ban/unban users (broadcaster only)
- **Settings** — Profile, AI shoutout toggle, data export/import

### Public Pages (no login needed)
- `/p` — Broadcaster profile with stream status, commands preview, queue, song requests, quotes
- `/p/commands` — All enabled chat commands
- `/p/queue` — Current viewer queue
- `/p/quotes` — Browse all quotes with game tags
- `/p/song-requests` — Current song request queue

---

## Infrastructure
- **Monorepo** — Turborepo with shared packages (DB, env, events, auth, API, server)
- **Database** — PostgreSQL via Prisma (shared schema across all services)
- **Redis** — EventBus pub/sub + BullMQ job queue
- **Auth** — Discord + Twitch OAuth via better-auth
- **Role hierarchy** — User < Moderator < Lead Moderator < Broadcaster (Admin)
- **Setup wizard** — First-user setup flow with one-time token
- **Docker** — docker-compose with PostgreSQL, Redis, and all services
- **Health checks** — `/health` endpoints on all services
- **657 unit tests** across 66 files + ~95 integration tests
