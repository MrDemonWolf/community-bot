# Todo

[] Create a command for the server owner aka they need amdin permission to set streamer name

# Add more to this list for features

---

# Variable Reference (Migration from Old Bot)

## Currently Supported Variables

These work right now in the `response` field of `TwitchChatCommand`:

| Variable | Description | Example |
|----------|-------------|---------|
| `{user}` | Username of the person who triggered the command | `Hey {user}!` → `Hey coolviewer!` |
| `{channel}` | Channel name where the command was used | `Welcome to {channel}!` → `Welcome to mrdemonwolf!` |
| `{args}` | Everything the user typed after the command | `!cmd hello world` → `{args}` = `hello world` |

## Old Bot Variables Found in Imported Commands

These were found in the old command JSON export. Commands using unsupported variables were imported as-is (the `${...}` text will print literally until support is added).

### Mapped (converted during import)

| Old Format | New Format | Used In | Notes |
|------------|-----------|---------|-------|
| `${user}` | `{user}` | lurk, lastseen | Triggering username |
| `${sender}` | `{user}` | hug, ram | Same as `${user}` — just an alias |
| `${channel}` | `{channel}` | time, win | Channel name |
| `${channel.display_name}` | `{channel}` | dragonsquish, stepladder, steppies | Display name with casing — mapped to `{channel}` |
| `${1\|@${channel.display_name}}` | `{args}` | dragonsquish, stepladder, steppies | First argument or default — mapped to `{args}` (no default fallback) |

### Implemented

| Old Format | New Format | Status |
|------------|-----------|--------|
| `${time America/Chicago}` | `${time America/Chicago}` | Done — uses `Intl.DateTimeFormat` |
| `${random.pick '...' '...'}` | `${random.pick '...' '...'}` | Done — parses quoted strings, picks random |
| `${random.chatter}` | `${random.chatter}` | Done — tracks active chatters via join/part/message events |
| `${1\|'default'}` | `${1\|default}` | Done — positional args with fallback |

### Not Supported (need future implementation)

| Old Format | Used In | What It Does | Implementation Idea |
|------------|---------|--------------|---------------------|
| `${user.lastseen}` | lastseen | When user was last seen in channel | Requires user tracking table with last-seen timestamps |
| `${user.lastactive}` | lastseen | When user was last active in chat | Same tracking table, update on message |
| `${user.lastmessage}` | lastseen | User's last chat message | Store last message per user in DB |
| `${getcount <name>}` | win | Read a named counter value | Requires a `TwitchCounter` table (name + value) |
| `${count <name>}` | addwin | Increment a named counter and return new value | Same counter table with increment |
| `${count <name> -1}` | delwin | Decrement a named counter | Same counter table with decrement |
| `${count <name> 0}` | resetwin | Reset a named counter to a value | Same counter table with set |
| `${repeat <n> <text>}` | dance | Repeat text/emote N times | String repeat in variable substitution |
| `$(weather <zip>)` | weather | Weather lookup by zip code | External weather API (OpenWeatherMap, etc.) |

### Priority Suggestions

**Quick wins** (no external APIs, no new DB tables):
1. `${repeat <n> <text>}` — pure string manipulation

**Medium effort** (needs a new DB table):
2. `${getcount}` / `${count}` — counter system (new `TwitchCounter` model)

**Larger effort** (needs user tracking + memory):
3. `${user.lastseen}` / `${user.lastactive}` / `${user.lastmessage}` — user activity tracking

**External dependency** (needs API keys / services):
4. `$(weather)` — weather API integration
