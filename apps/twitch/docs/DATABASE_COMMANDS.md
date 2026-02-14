# Database Commands

The bot supports a full database-driven command system. Commands stored in the `TwitchChatCommand` table are loaded into memory on startup and can be managed without restarting the bot — either from chat via `!command` or through Prisma Studio.

## Managing from Chat

Mods and broadcasters can create and manage commands directly from chat using `!command`. See [COMMANDS.md](../COMMANDS.md#command) for full usage.

## Managing via Prisma Studio

```bash
pnpm db:studio
```

## Command Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | String | *required* | Trigger name without the `!` prefix (e.g., `hello`) |
| `enabled` | Boolean | `true` | Whether the command is active |
| `response` | String | *required* | Text to send. Supports [variables](#response-variables) |
| `responseType` | Enum | `SAY` | How to respond: `SAY`, `MENTION`, or `REPLY` |
| `globalCooldown` | Int | `0` | Cooldown in seconds shared across all users |
| `userCooldown` | Int | `0` | Cooldown in seconds per user |
| `accessLevel` | Enum | `EVERYONE` | Minimum role required |
| `limitToUser` | String? | `null` | If set, only this username can trigger the command |
| `streamStatus` | Enum | `BOTH` | When the command is active: `ONLINE`, `OFFLINE`, or `BOTH` |
| `hidden` | Boolean | `false` | For future GUI filtering |
| `aliases` | String[] | `[]` | Alternative trigger names (e.g., `["hi", "hey"]`) |
| `keywords` | String[] | `[]` | Stream title keywords — command only active when title contains at least one |
| `regex` | String? | `null` | If set, triggers on pattern match instead of `!prefix` |

## Response Types

| Type | Behavior | Example Output |
|------|----------|----------------|
| `SAY` | Sends a plain message | `Hello world!` |
| `MENTION` | Prefixes with @username | `@user Hello world!` |
| `REPLY` | Sends as a threaded reply | *(reply to user's message)* `Hello world!` |

## Response Variables

Use these placeholders in the `response` field:

| Variable | Replaced With | Example |
|----------|---------------|---------|
| `{user}` | Username of the person who triggered the command | `Hey {user}!` → `Hey coolviewer!` |
| `{channel}` | Channel name where the command was used | `Welcome to {channel}!` → `Welcome to mrdemonwolf!` |
| `{args}` | Everything the user typed after the command name | `!cmd hello world` → `{args}` = `hello world` |
| `${1}`, `${2}`, etc. | Positional argument (1-indexed) | `!cmd foo bar` → `${1}` = `foo`, `${2}` = `bar` |
| `${1\|fallback}` | Positional argument with a default fallback | `${1\|@mrdemonwolf}` → uses `@mrdemonwolf` if no arg given |
| `${random.pick '...' '...'}` | Random choice from a quoted list | `${random.pick 'hi' 'hello' 'hey'}` → one at random |
| `${random.chatter}` | A random active user currently in the channel | `Shoutout to ${random.chatter}!` |
| `${time <timezone>}` | Current time in the given timezone | `${time America/Chicago}` → `3:45 PM` |

**Example:** A command with response `Hey {user}, welcome to {channel}!` and type `SAY` would output: `Hey coolviewer, welcome to mrdemonwolf!`

## Access Levels

Access levels follow a hierarchy — higher levels include all permissions of lower levels:

| Level | Rank | Who | Cooldown Bypass |
|-------|------|-----|-----------------|
| `EVERYONE` | 0 | All users | No |
| `SUBSCRIBER` | 1 | Subscribers and founders | No |
| `REGULAR` | 2 | Users in the `TwitchRegular` table | No |
| `VIP` | 3 | VIPs | No |
| `MODERATOR` | 4 | Moderators | Yes |
| `BROADCASTER` | 5 | The channel owner | Yes |

## Regex Commands

If the `regex` field is set, the command ignores the `!prefix` system entirely. Instead, it tests the **full message text** against the regex pattern. This is useful for auto-responses.

**Example:** A command with `regex` set to `gg` and response `GG {user}!` would trigger whenever someone types a message containing "gg".

## Cooldowns

- **Global cooldown** — after any user triggers the command, it's locked for everyone for N seconds
- **User cooldown** — after a specific user triggers it, only that user is locked for N seconds
- Moderators and broadcasters bypass all cooldowns

## Stream Status Filtering

| Value | Command Active When |
|-------|---------------------|
| `BOTH` | Always |
| `ONLINE` | Stream is live |
| `OFFLINE` | Stream is offline |

If `keywords` are set, the command additionally requires the stream title to contain at least one of the keywords.

## Managing Regulars

The `TwitchRegular` table defines users who get the REGULAR access level (rank 2, between SUBSCRIBER and VIP). Manage them via Prisma Studio:

```bash
pnpm db:studio
```

Each regular needs:

| Field | Description |
|-------|-------------|
| `twitchUserId` | The user's Twitch ID |
| `twitchUsername` | Display name (for reference) |
| `addedBy` | Who added them (for record keeping) |

## Reloading Without Restart

Commands and regulars are automatically reloaded from the database every 60 seconds. To reload immediately, type `!reloadcommands` in chat (mod/broadcaster only).

## Command Execution Pipeline

When a message arrives in chat, it goes through a 3-phase pipeline. The first match wins:

1. **Phase 1: Built-in commands** — Checks the `!` prefix against hardcoded commands. Always runs (except when muted, only `!bot unmute` is allowed).
2. **Phase 2: Database prefix commands** — Looks up the `!` prefix in the command cache (by name or alias). Checks access level, cooldowns, stream status, keywords, and limitToUser.
3. **Phase 3: Database regex commands** — Tests the full message against compiled regex patterns. Same checks as Phase 2.

## Importing Legacy Commands

The bot includes a JSON file with legacy commands that can be imported into the database:

```bash
pnpm db:import                        # Import from prisma/commands.json
pnpm db:import path/to/commands.json  # Import from a custom file
```
