# Commands Reference

All built-in commands for the Community Bot. These are hardcoded and always available.

---

## Overview

| Command | Aliases | Access Level | Description |
|---------|---------|--------------|-------------|
| `!ping` | — | Everyone | Replies with Pong! |
| `!uptime` | — | Everyone | Shows stream uptime or offline duration |
| `!accountage` | `!accage`, `!created` | Everyone | Shows Twitch account creation date |
| `!bot` | — | Broadcaster | Mute/unmute the bot |
| `!queue` | — | Everyone / Mod+ | Viewer queue system |
| `!filesay` | — | Broadcaster | Send lines from a text file to chat |
| `!command` | — | Moderator+ | Manage database commands from chat |
| `!reloadcommands` | — | Moderator+ | Reload commands and regulars from DB |

---

## Command Details

### !ping

| Property | Value |
|----------|-------|
| **Access** | Everyone |
| **Aliases** | None |
| **Arguments** | None |
| **Source** | `src/commands/ping.ts` |

Replies with `@user Pong!`. A simple health-check command to verify the bot is responding.

**Example:**
```
User:  !ping
Bot:   @User Pong!
```

---

### !uptime

| Property | Value |
|----------|-------|
| **Access** | Everyone |
| **Aliases** | None |
| **Arguments** | None |
| **Source** | `src/commands/uptime.ts` |

Shows how long the stream has been live, or how long it has been offline. Uses the stream status manager which polls the Twitch Helix API every 60 seconds.

**Format:** `Xd Xh Xm` (days, hours, minutes)

**Examples:**
```
User:  !uptime
Bot:   mrdemonwolf has been live for 2h 34m

User:  !uptime
Bot:   mrdemonwolf has been offline for 1d 5h 12m
```

---

### !accountage

| Property | Value |
|----------|-------|
| **Access** | Everyone |
| **Aliases** | `!accage`, `!created` |
| **Arguments** | Optional: `@username` or `username` |
| **Source** | `src/commands/accountage.ts` |

Looks up when a Twitch account was created using the Twitch Helix API. If no username is provided, checks the caller's own account.

**Format:** `X years X months X days X hours`

**Examples:**
```
User:      !accountage
Bot:       @User, User was created 3 years 5 months ago

User:      !accountage @mrdemonwolf
Bot:       @User, MrDemonWolf was created 7 years 2 months 14 days ago

User:      !accage someuser
Bot:       @User, someuser was created 1 year 8 months ago

User:      !accountage doesnotexist
Bot:       @User, user "doesnotexist" not found.
```

---

### !bot

| Property | Value |
|----------|-------|
| **Access** | Broadcaster only |
| **Aliases** | None |
| **Subcommands** | `mute`, `unmute` |
| **Source** | `src/commands/bot.ts` |

Controls the bot's mute state. When muted, the bot ignores all commands except `!bot unmute`. Mute state is in-memory only (resets on restart).

| Subcommand | Description |
|------------|-------------|
| `!bot mute` | Silences the bot — no commands will respond |
| `!bot unmute` | Re-enables the bot |

**Examples:**
```
Broadcaster:  !bot mute
Bot:          @Broadcaster, I have been muted.

(all other commands are now ignored)

Broadcaster:  !bot unmute
Bot:          @Broadcaster, I have been unmuted.
```

---

### !queue

| Property | Value |
|----------|-------|
| **Access** | Everyone (viewer commands) / Moderator+ (management commands) |
| **Aliases** | None |
| **Source** | `src/commands/queue.ts` |

A full viewer queue system with open/closed/paused states. Queue positions auto-adjust when entries are removed.

#### Viewer Subcommands

| Subcommand | Description |
|------------|-------------|
| `!queue join` | Join the queue (queue must be open) |
| `!queue leave` | Remove yourself from the queue |
| `!queue position` | Check your position in the queue |
| `!queue list` | View the first 10 entries and total count |

#### Mod/Broadcaster Subcommands

| Subcommand | Description |
|------------|-------------|
| `!queue open` | Open the queue for new joins |
| `!queue close` | Close the queue (no new joins) |
| `!queue pause` | Pause the queue (no new joins, signals temporary hold) |
| `!queue unpause` | Resume the queue (sets status back to open) |
| `!queue pick next` | Pick the next person in line (position 1) |
| `!queue pick random` | Pick a random person from the queue |
| `!queue pick <username>` | Pick a specific user by name |
| `!queue remove <username>` | Remove a user from the queue |
| `!queue clear` | Clear all entries from the queue |

#### Queue States

| State | Behavior |
|-------|----------|
| `OPEN` | Users can join and leave |
| `CLOSED` | No new joins allowed |
| `PAUSED` | No new joins allowed (temporary hold) |

**Examples:**
```
Mod:   !queue open
Bot:   @Mod, the queue is now open!

User:  !queue join
Bot:   @User, you joined the queue at position 1.

User:  !queue position
Bot:   @User, you are at position 1 in the queue.

User:  !queue list
Bot:   Queue: 1. User, 2. Viewer2, 3. Viewer3

Mod:   !queue pick next
Bot:   @Mod, picked: User (was position 1)

Mod:   !queue clear
Bot:   @Mod, the queue has been cleared.
```

---

### !filesay

| Property | Value |
|----------|-------|
| **Access** | Broadcaster only |
| **Aliases** | None |
| **Arguments** | `<url>` (required, must be http or https) |
| **Source** | `src/commands/filesay.ts` |

Fetches a plain text file from a URL and sends each non-empty line to chat with a 1-second delay between lines. Validates that the URL uses http or https protocol.

**Examples:**
```
Broadcaster:  !filesay https://example.com/rules.txt
Bot:          Rule 1: Be kind to everyone.
Bot:          Rule 2: No spam.
Bot:          Rule 3: Have fun!

Broadcaster:  !filesay
Bot:          @Broadcaster, usage: !filesay <url>

Broadcaster:  !filesay not-a-url
Bot:          @Broadcaster, invalid URL.
```

---

### !command

| Property | Value |
|----------|-------|
| **Access** | Moderator+ |
| **Aliases** | None |
| **Subcommands** | `add`, `edit`, `remove`/`delete`, `show`, `options` |
| **Source** | `src/commands/command.ts` |

Full command management system for database-driven commands. Changes take effect immediately (auto-reloads the command cache). Cannot create commands with the same name as built-in commands.

#### Subcommands

| Subcommand | Usage | Description |
|------------|-------|-------------|
| `add` | `!command add <name> <response>` | Create a new command |
| `edit` | `!command edit <name> <response>` | Update a command's response text |
| `remove` | `!command remove <name>` | Delete a command |
| `delete` | `!command delete <name>` | Same as remove |
| `show` | `!command show <name>` | Display all details of a command |
| `options` | `!command options <name> <flags...>` | Modify command properties |

#### Option Flags

| Flag | Argument | Description |
|------|----------|-------------|
| `-cd` | `<seconds>` | Set global cooldown (shared across all users) |
| `-usercd` | `<seconds>` | Set per-user cooldown |
| `-level` | `<level>` | Set minimum access level: `everyone`, `subscriber`, `regular`, `vip`, `moderator`, `broadcaster` |
| `-type` | `<type>` | Set response type: `say`, `mention`, `reply` |
| `-enable` | — | Enable the command |
| `-disable` | — | Disable the command |
| `-hidden` | — | Mark the command as hidden |
| `-visible` | — | Mark the command as visible |
| `-stream` | `<status>` | Set stream filter: `online`, `offline`, `both` |
| `-limituser` | `<username>` | Restrict to a specific user. Use `clear` to remove the restriction |
| `-alias` | `add <name>` or `remove <name>` | Add or remove an alias trigger |

**Examples:**
```
Mod:  !command add hello Hello {user}, welcome!
Bot:  @Mod Command !hello has been added.

Mod:  !command edit hello Hey there {user}!
Bot:  @Mod Command !hello has been updated.

Mod:  !command options hello -cd 30 -type mention -level subscriber
Bot:  @Mod Options for !hello have been updated.

Mod:  !command options hello -alias add hi
Bot:  @Mod Options for !hello have been updated.

Mod:  !command show hello
Bot:  @Mod !hello [enabled] type:mention level:subscriber cd:30s usercd:0s aliases:hi | Hey there {user}!

Mod:  !command remove hello
Bot:  @Mod Command !hello has been removed.
```

---

### !reloadcommands

| Property | Value |
|----------|-------|
| **Access** | Moderator+ |
| **Aliases** | None |
| **Arguments** | None |
| **Source** | `src/commands/reloadCommands.ts` |

Forces an immediate reload of database commands and regulars into memory. Normally this happens automatically every 60 seconds, but this command triggers it instantly.

**Example:**
```
Mod:  !reloadcommands
Bot:  @Mod Commands and regulars reloaded!
```

---

## Access Level Hierarchy

Commands check user access level in this order (higher levels include all permissions below):

| Level | Rank | Who | Cooldown Bypass |
|-------|------|-----|-----------------|
| `BROADCASTER` | 5 | Channel owner | Yes |
| `MODERATOR` | 4 | Moderators | Yes |
| `VIP` | 3 | VIPs | No |
| `REGULAR` | 2 | Users in the TwitchRegular table | No |
| `SUBSCRIBER` | 1 | Subscribers and Founders | No |
| `EVERYONE` | 0 | All users | No |

---

## Database Command Variables

These variables can be used in the `response` field of database commands created via `!command add`:

| Variable | Description | Example |
|----------|-------------|---------|
| `{user}` | Username of the command trigger | `Hey {user}!` |
| `{channel}` | Channel name | `Welcome to {channel}!` |
| `{args}` | All text after the command name | `You said: {args}` |
| `${1}`, `${2}`, etc. | Positional argument (1-indexed) | `Hello ${1}!` |
| `${1\|fallback}` | Positional argument with default | `${1\|@mrdemonwolf}` |
| `${random.pick '...' '...'}` | Random choice from list | `${random.pick 'hi' 'hello' 'hey'}` |
| `${random.chatter}` | Random active user in channel | `Shoutout to ${random.chatter}!` |
| `${time <timezone>}` | Current time in a timezone | `${time America/Chicago}` |
