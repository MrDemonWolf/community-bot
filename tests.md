# Phase 1 Manual Testing Checklist

## Prerequisites

- Local PostgreSQL and Redis running (`docker compose up -d postgres redis`)
- Run `pnpm db:migrate` to apply schema changes
- Run `pnpm db:generate` to regenerate Prisma client
- All apps running (`pnpm dev`)

## A. Enhanced Twitch Notifications

### A1. Per-Channel Notification Overrides

- [ ] Open `/dashboard/discord` — verify "Monitored Channels" card appears below Test Notification
- [ ] Each monitored Twitch channel shows display name, avatar, and live/offline status
- [ ] Channels with overrides show "(overrides active)" indicator
- [ ] Click "Configure" on a channel — dialog opens with correct current values

### A2. Channel Settings Dialog

- [ ] Notification Channel Override dropdown loads guild text/announcement channels
- [ ] Notification Role Override dropdown loads guild roles + @everyone option
- [ ] "Use guild default" option works (sets override to null)
- [ ] Toggle: "Update message while live" defaults to on
- [ ] Toggle: "Delete when offline" defaults to off
- [ ] Toggle: "Auto-publish in announcement channels" defaults to off
- [ ] Toggle: "Use custom embed message" defaults to off
- [ ] Save button saves settings and shows success toast
- [ ] Audit log records `discord.channel-settings` action

### A3. Custom Embed JSON

- [ ] Enabling "Use custom embed message" reveals online/offline JSON textareas
- [ ] Embed preview renders below each textarea in real-time
- [ ] Preview shows title, description, fields, author, footer, color bar
- [ ] Template variables display with sample data: `{streamer}`, `{title}`, `{game}`, `{viewers}`, `{url}`, `{thumbnail}`, `{duration}`
- [ ] Invalid JSON shows "Invalid JSON — preview unavailable" message
- [ ] Empty textarea shows "Enter embed JSON to see preview"

### A4. Notification Behavior (requires live Twitch stream or test notification)

- [ ] **Per-channel override**: Configure a channel with a different notification channel — verify notification goes to the override channel, not the guild default
- [ ] **Per-channel role override**: Configure a channel with a different role — verify the correct role is mentioned
- [ ] **Update message while live = OFF**: Verify the "Still Live" embed update is skipped (title/game/viewer count stay at initial values)
- [ ] **Delete when offline**: When stream goes offline, the notification message is deleted (not edited to offline embed)
- [ ] **Auto-publish**: Send notification to an announcement channel with auto-publish on — verify the message is crossposted
- [ ] **Custom online embed**: Set custom JSON for online notification — verify custom embed is used instead of default
- [ ] **Custom offline embed**: Set custom JSON for offline notification — verify custom embed is used when stream goes offline
- [ ] **Invalid custom JSON fallback**: Set invalid JSON with custom message enabled — verify default embed is used as fallback
- [ ] **Guild default fallback**: Leave channel overrides blank — verify guild-level channel/role settings are used

### A5. Test Notification with Overrides

- [ ] Send test notification with per-channel overrides configured — verify it respects the channel-level settings

## B. Inactive Account Cleanup

### B1. Job Scheduling

- [ ] Verify `cleanup-inactive-accounts` job appears in worker logs on startup
- [ ] Job is scheduled with cron pattern `0 3 * * *` (daily at 3 AM)

### B2. Cleanup Logic (manual trigger or wait for cron)

- [ ] Create a test user with role USER, no sessions, created > 1 year ago — verify deleted
- [ ] Verify ADMIN users are NOT deleted regardless of inactivity
- [ ] Verify MODERATOR users are NOT deleted regardless of inactivity
- [ ] Verify LEAD_MODERATOR users are NOT deleted regardless of inactivity
- [ ] Verify the broadcaster account is NOT deleted regardless of inactivity
- [ ] Verify users with recent sessions (within 365 days) are NOT deleted
- [ ] Verify users created within 365 days (even with no sessions) are NOT deleted
- [ ] Check logs for deletion count message

## C. Discord Welcome Messages (Phase 2)

### Prerequisites

- [ ] Enable **Server Members Intent** in Discord Developer Portal → Bot → Privileged Gateway Intents
- [ ] Bot is running and connected to your Discord server
- [ ] Web dashboard is running and Discord guild is linked

### C1. Welcome Message

- [ ] Enable welcome message in dashboard → Discord → Welcome & Leave Messages
- [ ] Select a channel and enter a plain text message (e.g., `Welcome {displayName} to {server}! We now have {memberCount} members.`)
- [ ] Save settings
- [ ] Join the guild with an alt account — verify message appears in the selected channel with variables replaced
- [ ] Switch to embed mode, paste custom embed JSON, verify preview renders
- [ ] Save and rejoin — verify embed appears in channel

### C2. Leave Message

- [ ] Enable leave message in dashboard
- [ ] Select a channel and enter a plain text message (e.g., `{displayName} has left {server}. ({memberCount} members)`)
- [ ] Save settings
- [ ] Leave the guild with the alt account — verify leave message appears
- [ ] Test embed mode similarly

### C3. Auto-Role

- [ ] Enable auto-role in dashboard
- [ ] Select a role from the dropdown
- [ ] Save settings
- [ ] Join the guild with an alt account — verify the role is assigned automatically
- [ ] Verify error is logged (not crashed) if bot lacks Manage Roles permission or role is higher than bot's role

### C4. DM Welcome

- [ ] Enable DM welcome in dashboard
- [ ] Enter a plain text DM message (e.g., `Welcome to {server}, {displayName}! Check out the rules channel.`)
- [ ] Save settings
- [ ] Join the guild with an alt account (with DMs enabled) — verify DM is received
- [ ] Join with DMs disabled — verify bot logs error but doesn't crash
- [ ] Test embed mode for DM

### C5. Test Buttons

- [ ] Click **Test Welcome** — verify welcome message appears in the configured channel (uses bot's own member as stand-in)
- [ ] Click **Test Leave** — verify leave message appears in the configured channel
- [ ] Click **Test DM** — verify DM is sent to the bot (check logs for success/failure)
- [ ] Verify buttons are disabled when corresponding features are not enabled or channels not set

### C6. Edge Cases

- [ ] Verify all three actions (welcome, DM, auto-role) fire independently — failure in one does not block others
- [ ] Verify partial guild member (leave event for uncached member) doesn't crash — uses "Unknown" for missing fields
- [ ] Verify settings persist after page reload
- [ ] Verify audit log entries appear for `discord.welcome-settings` and `discord.test-welcome` actions
- [ ] Verify embed preview updates in real-time as JSON is typed
- [ ] Verify template variables (`{user}`, `{username}`, `{displayName}`, `{server}`, `{memberCount}`, `{tag}`) all resolve correctly

## D. Visual Embed Builder UI (Phase 3)

### D1. Channel Settings Dialog (Twitch Notifications)

- [ ] Open a monitored channel's settings dialog (Configure button)
- [ ] Enable "Use custom embed message" toggle
- [ ] **Online Embed Builder** appears with form sections and preview
- [ ] **Offline Embed Builder** appears below it
- [ ] Edit title/description — preview updates live
- [ ] Pick a color from presets — left border in preview changes
- [ ] Enter a hex color manually — preview reflects it
- [ ] Open Author section — fill name/icon/url — preview shows author row
- [ ] Add a field — name + value appear in preview
- [ ] Toggle field "Inline" checkbox — field layout changes in preview
- [ ] Add multiple fields, reorder with up/down — preview reflects order
- [ ] Remove a field — disappears from preview
- [ ] Open Images section — enter thumbnail URL — preview shows placeholder
- [ ] Open Footer section — enter text — footer appears in preview
- [ ] Toggle timestamp checkbox
- [ ] Click a variable pill (e.g. `{streamer}`) — toast confirms copied to clipboard
- [ ] Paste variable into title/description — preview substitutes with sample value
- [ ] Open "JSON Import / Export" — JSON textarea shows current embed JSON
- [ ] Copy button copies JSON to clipboard
- [ ] Modify JSON in textarea → click "Apply JSON" — form updates to match
- [ ] Enter invalid JSON → click "Apply JSON" — inline error shown
- [ ] Clear all fields — JSON output becomes empty string
- [ ] Save settings → reload dialog — form repopulates from saved JSON
- [ ] Both Online and Offline builders work independently

### D2. Welcome Settings — Welcome Message

- [ ] Navigate to Dashboard > Discord > Welcome & Leave Messages
- [ ] Enable Welcome Message → switch to "Embed" mode
- [ ] Embed Builder appears with full two-column layout (desktop)
- [ ] Variable pills show: `{user}`, `{username}`, `{displayName}`, `{server}`, `{memberCount}`, `{tag}`
- [ ] All form sections work (Basic, Author, Fields, Images, Footer)
- [ ] Preview updates live with sample variable substitutions
- [ ] JSON Import/Export works
- [ ] Save Welcome Settings → reload page → form repopulates correctly
- [ ] Switch back to "Plain Text" mode — VariableHint shows, builder hides

### D3. Welcome Settings — Leave Message

- [ ] Enable Leave Message → switch to "Embed" mode
- [ ] Embed Builder appears with same functionality as welcome
- [ ] All form sections, preview, variables, JSON import/export work
- [ ] Save → reload → form repopulates

### D4. Welcome Settings — DM Welcome

- [ ] Enable DM Welcome → switch to "Embed" mode
- [ ] Embed Builder appears (no channel selector for DM)
- [ ] All form sections, preview, variables, JSON import/export work
- [ ] Save → reload → form repopulates

### D5. Responsive / Layout

- [ ] Desktop (≥768px): two-column layout — form left, sticky preview right
- [ ] Mobile (<768px): single column — form on top, preview below
- [ ] Channel settings dialog: always compact (single column) since inside dialog
- [ ] Collapsible sections toggle open/close correctly
- [ ] Fields section auto-opens when fields exist

### D6. Edge Cases

- [ ] Empty initial value — form starts blank, preview shows "Enter embed JSON to see preview"
- [ ] Existing JSON from Phase 1/2 — form correctly parses and populates all fields
- [ ] Max 25 fields — "Add Field" button disables at 25, counter shows `(25/25)`
- [ ] Color input accepts only valid hex patterns
- [ ] Fields with empty name/value are omitted from JSON output

## E. Public Pages Polish (Phase 4)

### E1. Layout & Sidebar

- [ ] Visit `/p` — banner + sidebar + content renders correctly
- [ ] Visit `/p/commands` — sidebar shows with Commands link active
- [ ] Visit `/p/queue` — sidebar shows with Queue link active
- [ ] Navigate between `/p`, `/p/commands`, `/p/queue` — sidebar active state updates without full page reload
- [ ] Sidebar nav only shows Commands link if commands exist
- [ ] Sidebar nav only shows Queue link if queue is not CLOSED
- [ ] Banner height and avatar size are consistent across all 3 pages

### E2. Entrance Animations

- [ ] `/p` — sidebar card fades in, each content card staggers in sequence
- [ ] `/p/commands` — header and tabs fade in with stagger
- [ ] `/p/queue` — header and queue entries fade in with stagger

### E3. Responsive / Mobile

- [ ] Resize to mobile (<640px) — sidebar becomes horizontal row with avatar + name inline
- [ ] `/p/commands` on mobile — commands display as cards (not a table)
- [ ] `/p/commands` on desktop (≥640px) — commands display as a table
- [ ] Queue page looks correct on mobile

### E4. SEO Metadata

- [ ] `/p` — page has `<title>` like "{username}'s Community" and a meta description
- [ ] `/p/commands` — page has `<title>` like "Commands — {username}" and a meta description
- [ ] `/p/queue` — page has `<title>` like "Viewer Queue — {username}" and a meta description

### E5. Landing Page

- [ ] "View Profile" button visible in hero section when `NEXT_PUBLIC_CHANNEL_NAME` is set
- [ ] "View Profile" button links to `/p`
- [ ] Button does not render when `NEXT_PUBLIC_CHANNEL_NAME` is not set

## F. Auth, Permissions & User Management (Phase 5)

### F1. Schema Migration

- [ ] `pnpm db:migrate` runs cleanly (renames ADMIN→BROADCASTER, adds ban fields)
- [ ] Existing ADMIN users in the database are now BROADCASTER after migration
- [ ] `pnpm check-types` — no type errors

### F2. USER Role

- [ ] Can log in and view dashboard
- [ ] Can view commands page (read-only — no create/edit/delete buttons)
- [ ] Can view regulars page (read-only — no add/remove buttons)
- [ ] Can view Discord settings (read-only — no mutation controls)
- [ ] Cannot see Users page in sidebar
- [ ] Cannot access `/dashboard/users` directly (tRPC rejects)
- [ ] Bot controls card is visible but enable/disable/mute are hidden
- [ ] Can view own profile in Settings page
- [ ] Can export data

### F3. MODERATOR Role

- [ ] All USER permissions plus:
- [ ] Can create, edit, delete, and toggle commands
- [ ] Can add and remove regulars
- [ ] Can import from StreamElements
- [ ] Cannot enable/disable/mute the bot
- [ ] Cannot modify Discord settings
- [ ] Cannot see Users page in sidebar

### F4. LEAD_MODERATOR Role

- [ ] All MODERATOR permissions plus:
- [ ] Can enable/disable the bot
- [ ] Can mute/unmute the bot
- [ ] Can update default command toggles and access levels
- [ ] Can modify all Discord settings (link guild, set channel/role, enable/disable, welcome, test notifications)
- [ ] Cannot see Users page in sidebar

### F5. BROADCASTER Role

- [ ] All LEAD_MODERATOR permissions plus:
- [ ] Can see "Management" section with "Users" link in sidebar
- [ ] Can access `/dashboard/users` page
- [ ] Can search users by name/email
- [ ] Can filter users by role
- [ ] Can change a user's role (USER ↔ MODERATOR ↔ LEAD_MODERATOR)
- [ ] Cannot change own role (tRPC rejects)
- [ ] Cannot change another BROADCASTER's role (tRPC rejects)
- [ ] Can ban a user with an optional reason
- [ ] Can unban a user
- [ ] Cannot ban self (tRPC rejects)
- [ ] Audit log shows all entries (BROADCASTER sees everything)

### F6. Ban System

- [ ] Banned user can still log in
- [ ] Banned user sees "Account Suspended" page with ban reason when accessing `/dashboard`
- [ ] Banned user's tRPC mutations are rejected with FORBIDDEN
- [ ] Unbanning restores dashboard access immediately
- [ ] Ban reason displays correctly (or gracefully hidden if none)

### F7. Setup Wizard

- [ ] First user completing setup is promoted to BROADCASTER (not ADMIN)
- [ ] Setup wizard text says "Sign in to become the broadcaster."

### F8. Audit Log

- [ ] Role change logged as `user.role-change` with previous/new role
- [ ] Ban logged as `user.ban` with target name and reason
- [ ] Unban logged as `user.unban` with target name
- [ ] BROADCASTER sees all audit entries
- [ ] LEAD_MODERATOR sees entries from their level and below
- [ ] MODERATOR sees entries from their level and below
- [ ] USER sees only USER-level entries

### F9. Auto-Link Twitch from Discord (On Login)

- [ ] Discord OAuth now requests `connections` scope (check consent screen)
- [ ] After Discord login, if user has verified Twitch connection and no Twitch account linked, Account entry is auto-created
- [ ] No duplicate created if Twitch already linked
- [ ] No error if no Twitch connection on Discord

### F10. Auto-Link Twitch from Discord (Background Sync)

- [ ] `sync-twitch-links` job scheduled daily at 4 AM
- [ ] Job processes users with Discord OAuth tokens
- [ ] Skips users who already have Twitch linked
- [ ] Creates Twitch Account entries for users with verified Twitch connections
- [ ] Handles expired/invalid tokens gracefully (skips, no crash)
- [ ] Logs summary (linked, skipped, errors)

### F11. Regression

- [ ] Commands CRUD still works for MODERATOR+ roles
- [ ] Regulars add/remove still works for MODERATOR+ roles
- [ ] Bot enable/disable/mute still works for LEAD_MODERATOR+ roles
- [ ] Discord settings still work for LEAD_MODERATOR+ roles
- [ ] Cleanup inactive accounts job still only targets USER role
- [ ] Role display badges show correctly (Owner, Lead Mod, Moderator, User)
- [ ] Channel owner USER still shows "Owner" badge via `getRoleDisplay`

## G. Dashboard UI Role Guards (Phase 5b)

### G1. Bot Controls Card (`/dashboard`)

- [ ] **USER**: Join/Leave/Mute/Unmute buttons hidden, "managed by lead moderators" message shown
- [ ] **MODERATOR**: Same as USER — buttons hidden, read-only message shown
- [ ] **LEAD_MODERATOR**: All bot control buttons visible and functional
- [ ] **BROADCASTER**: All bot control buttons visible and functional
- [ ] Bot status text (active/muted/not joined) visible to all roles

### G2. Custom Commands (`/dashboard/commands` — Custom tab)

- [ ] **USER**: Command list visible, search works, Create/Edit/Delete/Toggle all hidden
- [ ] **MODERATOR**: All controls visible — Create, Edit, Delete, Toggle per row
- [ ] **LEAD_MODERATOR**: Same as MODERATOR
- [ ] **BROADCASTER**: Same as MODERATOR
- [ ] Empty state "Create your first command" button hidden for USER

### G3. Default Commands (`/dashboard/commands` — Default tab)

- [ ] **USER**: Command list visible, toggle switches replaced with static "On"/"Off" text, access level shows as plain text
- [ ] **MODERATOR**: Same as USER — toggles and dropdowns hidden (these are botChannel mutations)
- [ ] **LEAD_MODERATOR**: Interactive toggle switches and access level dropdowns visible
- [ ] **BROADCASTER**: Same as LEAD_MODERATOR

### G4. Regulars (`/dashboard/regulars`)

- [ ] **USER**: Regulars list visible, search works, Refresh Names visible, Add/Remove hidden
- [ ] **MODERATOR**: Add Regular button visible, Remove buttons visible per row
- [ ] **LEAD_MODERATOR**: Same as MODERATOR
- [ ] **BROADCASTER**: Same as MODERATOR
- [ ] Empty state "Add your first regular" button hidden for USER

### G5. Discord Settings (`/dashboard/discord`)

- [ ] **USER**: Guild info visible, all mutation controls hidden (enable/disable, save buttons, test notification, configure buttons)
- [ ] **USER** (unlinked): Shows "No Discord server linked yet. A lead moderator can link one."
- [ ] **MODERATOR**: Same as USER
- [ ] **LEAD_MODERATOR**: All controls visible — Link Server, Enable/Disable, Save Channel/Role, Send Test, Configure per channel, all Welcome settings
- [ ] **BROADCASTER**: Same as LEAD_MODERATOR
- [ ] Read-only notification channel shows "# channel-name" or "Not set"
- [ ] Read-only notification role shows "@role-name", "@everyone", or "Not set"

### G6. Welcome & Leave Settings (within Discord Settings)

- [ ] **USER/MODERATOR**: Enable/Disable buttons hidden, form sections hidden when enabled, Test Messages section hidden
- [ ] **LEAD_MODERATOR+**: All toggles, editors, save buttons, and test buttons visible and functional

### G7. Settings Page (`/dashboard/settings` — Data tab)

- [ ] **USER**: Export Data button visible, StreamElements Import section hidden
- [ ] **MODERATOR**: Export Data + StreamElements Import both visible
- [ ] **LEAD_MODERATOR**: Same as MODERATOR
- [ ] **BROADCASTER**: Same as MODERATOR

### G8. No Silent Failures

- [ ] Verify that no hidden mutation buttons means no FORBIDDEN toast errors appear during normal navigation
- [ ] Read-only views display all data correctly — no missing information

## H. Viewer Queue Dashboard Management (Phase 6)

### H1. Queue Status Controls

- [ ] Open `/dashboard/queue` — page loads, shows current queue state
- [ ] Status badge shows correct color: green (OPEN), amber (PAUSED), grey (CLOSED)
- [ ] Click Open → status changes to OPEN, success toast, audit log entry created
- [ ] Click Pause → status changes to PAUSED, success toast
- [ ] Click Close → status changes to CLOSED, success toast
- [ ] Active status button is disabled (can't set status to current status)

### H2. Queue Entry Management

- [ ] With entries in queue: table shows position, username, joined time
- [ ] Pick Next removes the lowest position entry, returns username in toast
- [ ] Pick Random removes a random entry, returns username in toast
- [ ] Remove button on individual entry shows confirm/cancel before deleting
- [ ] After removing an entry, remaining entries reorder positions correctly
- [ ] Clear Queue shows confirm step, then removes all entries

### H3. Empty / Disabled States

- [ ] "Queue is empty" message shown when no entries exist
- [ ] "Enable the bot for your channel first" shown when bot is not enabled
- [ ] Pick Next / Pick Random / Clear Queue buttons hidden when queue is empty

### H4. Role Guards

- [ ] **USER**: Can see queue status and entry list (read-only), no control buttons
- [ ] **MODERATOR**: Can see and use all controls (Open/Close/Pause, Pick, Remove, Clear)
- [ ] **LEAD_MODERATOR**: Same as MODERATOR
- [ ] **BROADCASTER**: Same as MODERATOR

### H5. Sidebar & Quick Stats

- [ ] Sidebar shows "Queue" link with ListOrdered icon under Twitch section
- [ ] Queue link active state highlights when on `/dashboard/queue`
- [ ] Quick Stats card shows queue status (OPEN/PAUSED/CLOSED) with correct color
- [ ] Quick Stats card shows queue entry count

### H6. Audit Logging

- [ ] `queue.open` logged when opening queue
- [ ] `queue.close` logged when closing queue
- [ ] `queue.pause` logged when pausing queue
- [ ] `queue.pick` logged when picking entry (includes mode and username)
- [ ] `queue.remove-entry` logged when removing entry (includes username)
- [ ] `queue.clear` logged when clearing queue (includes count)

### H7. EventBus (Twitch Bot)

- [ ] Queue mutations from Twitch chat (`!queue join/leave/pick/remove/clear/open/close/pause`) publish `queue:updated` event
- [ ] Verify no crash if EventBus is not initialized (graceful catch in bot startup)

## I. Documentation Updates (Phase 7)

### I1. New Pages Exist and Render

- [ ] `/docs/web-dashboard/welcome-messages` — page loads with correct content
- [ ] `/docs/web-dashboard/user-management` — page loads with correct content
- [ ] `/docs/web-dashboard/queue-management` — page loads with correct content

### I2. Sidebar Navigation

- [ ] All 3 new pages appear in the sidebar under "Web Dashboard" section
- [ ] Order is: Overview, Public Pages, Audit Log, Discord Settings, Welcome & Leave Messages, User Management, Queue Management

### I3. No ADMIN Role References

- [ ] `grep -r "ADMIN" apps/docs/content/docs/` returns no results
- [ ] Setup wizard page says "BROADCASTER" not "ADMIN"
- [ ] Audit log page role hierarchy ends with BROADCASTER
- [ ] Web dashboard overview says BROADCASTER not ADMIN

### I4. Audit Log Action Table

- [ ] Audit log page lists all 28 actions across 7 sections (Bot Controls, Commands, Regulars, Discord, User Management, Queue, Imports)
- [ ] Includes Phase 2 actions: `discord.welcome-settings`, `discord.test-welcome`
- [ ] Includes Phase 1 action: `discord.channel-settings`
- [ ] Includes Phase 5 actions: `user.role-change`, `user.ban`, `user.unban`
- [ ] Includes Phase 6 actions: `queue.open`, `queue.close`, `queue.pause`, `queue.pick`, `queue.remove-entry`, `queue.clear`
- [ ] Includes bot.mute and bot.unmute actions

### I5. Queue System Page Accuracy

- [ ] Queue system page describes position-based model (not WAITING/PICKED/REMOVED statuses)
- [ ] Queue state table shows OPEN/CLOSED/PAUSED
- [ ] Entries are described as being deleted on pick/leave (not status changes)
- [ ] Dashboard management section exists with cross-link to `/docs/web-dashboard/queue-management`
- [ ] EventBus sync note is present

### I6. Discord Settings Page Updates

- [ ] Per-channel notification overrides section exists
- [ ] Lists all override options: custom channel, role, embed, update-while-live, delete-when-offline, auto-publish
- [ ] Welcome & Leave Messages section exists with cross-link
- [ ] Audit logging table includes `discord.channel-settings`, `discord.welcome-settings`, `discord.test-welcome`

### I7. Discord Bot Pages

- [ ] Discord bot overview lists welcome messages, auto-role, and DM welcome features
- [ ] Twitch notifications page has per-channel overrides section

### I8. Event Bus Page

- [ ] `discord:test-welcome` event listed in Discord Settings table with `{ guildId, type }` payload
- [ ] Queue section lists publisher as "Twitch, Web" (not "Any")
- [ ] Event Flow Summary ASCII table includes `queue:updated` and `discord:test-welcome` rows

### I9. Cross-Links

- [ ] Welcome messages page links work (from discord-settings, web-dashboard index)
- [ ] Queue management page links work (from queue-system, web-dashboard index)
- [ ] User management page link works (from web-dashboard index)

### I10. Build Verification

- [ ] `pnpm --filter docs build` succeeds with no errors
- [ ] All 40 pages generate successfully (34 original + 3 new + base paths)

## J. Automated Tests (Existing)

- [ ] Run `pnpm test` — all tests pass
- [ ] Run `pnpm check-types` — all packages pass (verified for Phase 6)
- [ ] Run `pnpm turbo build --filter="!web"` — all builds succeed

## K. Phase 8 — EventBus & tRPC API Unit Tests

### K1. Test Infrastructure

- [ ] `vitest.workspace.ts` includes `packages/events` and `packages/api`
- [ ] `packages/events/vitest.config.ts` exists with `name: "events"`
- [ ] `packages/api/vitest.config.ts` exists with `name: "api"`
- [ ] `packages/api/src/test-helpers.ts` exports `mockSession`, `mockUser`, `createMockPrisma`

### K2. EventBus Tests (`packages/events/src/bus.test.ts` — 11 tests)

- [ ] Publishes JSON-serialized messages to prefixed channel
- [ ] Uses custom prefix when provided
- [ ] Subscribes to prefixed Redis channel
- [ ] Only subscribes once for multiple handlers on same event
- [ ] Dispatches messages to registered handlers
- [ ] Dispatches to multiple handlers for same event
- [ ] Ignores messages for events without handlers
- [ ] Ignores malformed JSON messages
- [ ] `ping()` returns true when Redis responds PONG
- [ ] `ping()` returns false when Redis throws
- [ ] `disconnect()` unsubscribes and disconnects both clients

### K3. Audit Utility Tests (`packages/api/src/utils/audit.test.ts` — 5 tests)

- [ ] Looks up user role and creates audit log entry
- [ ] Defaults to USER role when user not found
- [ ] Stores optional metadata and ipAddress
- [ ] Stores userImage when provided
- [ ] Omits undefined optional fields

### K4. Bot Channel Router Tests (`packages/api/src/routers/botChannel.test.ts` — 17 tests)

- [ ] `getStatus` returns linked account status
- [ ] `getStatus` returns false when no accounts linked
- [ ] `getStatus` throws UNAUTHORIZED without session
- [ ] `enable` upserts botChannel and publishes `channel:join`
- [ ] `enable` throws when no Twitch account linked
- [ ] `enable` rejects USER and MODERATOR roles
- [ ] `disable` disables bot and publishes `channel:leave`
- [ ] `disable` throws when bot not enabled
- [ ] `mute` mutes bot and publishes `bot:mute`
- [ ] `mute` uses `bot.unmute` action for unmuting
- [ ] `mute` throws when bot not enabled
- [ ] `updateCommandToggles` updates and publishes event
- [ ] `updateCommandToggles` throws for invalid command names
- [ ] `updateCommandAccessLevel` creates override for non-default level
- [ ] `updateCommandAccessLevel` deletes override when resetting to default
- [ ] `updateCommandAccessLevel` throws for invalid command name

### K5. Chat Command Router Tests (`packages/api/src/routers/chatCommand.test.ts` — 18 tests)

- [ ] `list` returns commands for user's bot channel
- [ ] `list` throws PRECONDITION_FAILED when bot not enabled
- [ ] `list` throws UNAUTHORIZED without session
- [ ] `create` creates command and publishes `command:created`
- [ ] `create` lowercases command name
- [ ] `create` rejects built-in command names (BAD_REQUEST)
- [ ] `create` rejects duplicate names (CONFLICT)
- [ ] `create` rejects invalid characters via Zod
- [ ] `create` rejects USER role
- [ ] `update` updates command and publishes `command:updated`
- [ ] `update` throws NOT_FOUND for nonexistent command
- [ ] `update` throws NOT_FOUND for command in different channel
- [ ] `delete` deletes command and publishes `command:deleted`
- [ ] `delete` throws NOT_FOUND for nonexistent command
- [ ] `toggleEnabled` toggles state and publishes event
- [ ] `toggleEnabled` throws NOT_FOUND for nonexistent command

### K6. User Management Router Tests (`packages/api/src/routers/userManagement.test.ts` — 16 tests)

- [ ] `list` returns paginated users
- [ ] `list` supports search filtering
- [ ] `list` rejects non-BROADCASTER role
- [ ] `list` rejects unauthenticated calls
- [ ] `list` rejects banned users
- [ ] `getUser` returns user details
- [ ] `getUser` throws NOT_FOUND for missing user
- [ ] `updateRole` updates role and logs audit
- [ ] `updateRole` prevents changing own role
- [ ] `updateRole` prevents changing broadcaster's role
- [ ] `updateRole` throws NOT_FOUND for missing user
- [ ] `ban` bans user with reason and logs audit
- [ ] `ban` prevents banning yourself
- [ ] `ban` prevents banning the broadcaster
- [ ] `unban` unbans user and logs audit
- [ ] `unban` throws NOT_FOUND for missing user

### K7. Queue Router Tests (`packages/api/src/routers/queue.test.ts` — 14 tests)

- [ ] `getState` upserts and returns singleton state
- [ ] `list` returns entries ordered by position
- [ ] `setStatus` OPEN publishes event and logs `queue.open`
- [ ] `setStatus` CLOSED maps to `queue.close`
- [ ] `setStatus` PAUSED maps to `queue.pause`
- [ ] `setStatus` rejects USER role
- [ ] `removeEntry` removes entry, reorders positions, publishes event
- [ ] `removeEntry` throws NOT_FOUND for missing entry
- [ ] `pickEntry` picks next entry
- [ ] `pickEntry` throws NOT_FOUND for empty queue (next)
- [ ] `pickEntry` throws NOT_FOUND for empty queue (random)
- [ ] `clear` clears all entries and publishes event

### K8. Regular Router Tests (`packages/api/src/routers/regular.test.ts` — 12 tests)

- [ ] `list` returns all regulars
- [ ] `add` adds regular and publishes `regular:created`
- [ ] `add` throws NOT_FOUND when Twitch user doesn't exist
- [ ] `add` throws CONFLICT when already a regular
- [ ] `add` rejects USER role
- [ ] `remove` removes regular and publishes `regular:deleted`
- [ ] `remove` throws NOT_FOUND for missing regular
- [ ] `refreshUsernames` updates display names from Twitch

### K9. Discord Guild Router Tests (`packages/api/src/routers/discordGuild.test.ts` — 24 tests)

- [ ] `getStatus` returns linked guild info
- [ ] `getStatus` returns null when no guild linked
- [ ] `listAvailableGuilds` returns unlinked guilds
- [ ] `getGuildChannels` returns filtered text/announcement channels
- [ ] `getGuildChannels` throws NOT_FOUND when no guild linked
- [ ] `getGuildRoles` filters out managed roles and @everyone
- [ ] `linkGuild` links guild and publishes `discord:settings-updated`
- [ ] `linkGuild` throws NOT_FOUND for unknown guild
- [ ] `linkGuild` throws CONFLICT when linked to another user
- [ ] `linkGuild` rejects MODERATOR role
- [ ] `setNotificationChannel` sets channel and publishes event
- [ ] `setNotificationChannel` throws NOT_FOUND when no guild linked
- [ ] `setNotificationRole` sets role and publishes event
- [ ] `enable` enables notifications
- [ ] `disable` disables notifications
- [ ] `listMonitoredChannels` returns monitored channels
- [ ] `updateChannelSettings` updates settings and publishes event
- [ ] `updateChannelSettings` throws NOT_FOUND for unknown channel
- [ ] `updateWelcomeSettings` updates welcome settings
- [ ] `testWelcomeMessage` publishes test welcome event
- [ ] `testNotification` publishes test notification event
- [ ] `testNotification` throws PRECONDITION_FAILED when no channel set

### K10. User Router Tests (`packages/api/src/routers/user.test.ts` — 10 tests)

- [ ] `getProfile` returns profile with connected accounts
- [ ] `getProfile` throws NOT_FOUND when user doesn't exist
- [ ] `getProfile` throws UNAUTHORIZED without session
- [ ] `exportData` returns full user data export
- [ ] `exportData` returns null botChannel when none exists
- [ ] `importStreamElements` imports commands and publishes events
- [ ] `importStreamElements` skips existing commands
- [ ] `importStreamElements` skips invalid names
- [ ] `importStreamElements` maps SE access levels correctly
- [ ] `importStreamElements` throws PRECONDITION_FAILED when bot not enabled

### K11. Audit Log Router Tests (`packages/api/src/routers/auditLog.test.ts` — 7 tests)

- [ ] BROADCASTER sees all logs without role filter
- [ ] MODERATOR only sees USER and MODERATOR logs
- [ ] USER only sees USER logs
- [ ] Supports action and resourceType filters
- [ ] Returns isChannelOwner flag for each item
- [ ] Paginates results
- [ ] Throws UNAUTHORIZED without session

### K12. Setup Router Tests (`packages/api/src/routers/setup.test.ts` — 12 tests)

- [ ] `status` returns true when setup complete
- [ ] `status` returns false when not configured
- [ ] `status` works without authentication (public procedure)
- [ ] `getStep` returns current setup step
- [ ] `getStep` returns null when no step saved
- [ ] `getStep` requires authentication
- [ ] `saveStep` upserts the setup step
- [ ] `complete` completes setup with valid token
- [ ] `complete` throws FORBIDDEN with invalid token
- [ ] `complete` throws FORBIDDEN when no token exists
- [ ] `startBotAuth` initiates device code flow
- [ ] `startBotAuth` throws on Twitch API failure
- [ ] `pollBotAuth` returns pending when not yet complete
- [ ] `pollBotAuth` stores credentials on success
- [ ] `pollBotAuth` throws on non-pending errors
- [ ] `pollBotAuth` throws when validation fails

### K13. Full Suite Verification

- [ ] Run `pnpm test` — all 395 tests pass across 35 test files
- [ ] No test file has import/mock errors
- [ ] All new tests use `vi.hoisted()` pattern for mock factories

---

## Phase 9: Integration Tests — Bot Services & tRPC API with Real Database

### Prerequisites

- Local PostgreSQL running (`docker compose up -d postgres`)
- Create test database: `createdb -U postgres community_bot_test`
- Or set `TEST_DATABASE_URL` env var to your test database

### L1. Infrastructure

- [ ] `packages/db/src/test-client.ts` — exports `testPrisma`, `cleanDatabase()`, seed helpers
- [ ] `packages/db/src/integration-setup.ts` — runs `prisma migrate deploy` against test DB
- [ ] `packages/api/vitest.integration.config.ts` — includes `*.integration.test.ts`, sequential, 30s timeout
- [ ] `apps/twitch/vitest.integration.config.ts` — same pattern for Twitch bot
- [ ] `apps/discord/vitest.integration.config.ts` — same pattern for Discord bot
- [ ] `vitest.config.ts` (root) — excludes `*.integration.test.ts` from unit runs
- [ ] `pnpm test` runs only unit tests (395 tests, 35 files — no integration tests)
- [ ] `pnpm test:integration` runs all integration tests sequentially

### L2. tRPC Queue Router Integration (12 tests)

- [ ] `getState` creates and returns singleton CLOSED state
- [ ] `setStatus` persists OPEN status to real DB
- [ ] `setStatus` transitions between all statuses
- [ ] `list` returns entries ordered by position
- [ ] `removeEntry` removes entry and reorders positions via raw SQL
- [ ] `removeEntry` throws NOT_FOUND for non-existent entry
- [ ] `pickEntry` picks next (lowest position) and reorders
- [ ] `pickEntry` picks random entry
- [ ] `pickEntry` throws NOT_FOUND for empty queue (next)
- [ ] `pickEntry` throws NOT_FOUND for empty queue (random)
- [ ] `clear` removes all entries from database
- [ ] Position reordering verified with real `$executeRawUnsafe`

### L3. tRPC ChatCommand Router Integration (12 tests)

- [ ] `create` creates command with correct `botChannelId`
- [ ] `create` duplicate → CONFLICT error (compound unique constraint)
- [ ] `create` rejects built-in command names
- [ ] `create` lowercases name and aliases
- [ ] `list` returns only commands for user's bot channel
- [ ] `update` updates command fields in DB
- [ ] `update` throws NOT_FOUND for command from different channel
- [ ] `delete` removes command from DB
- [ ] `toggleEnabled` flips enabled flag

### L4. tRPC BotChannel Router Integration (8 tests)

- [ ] `getStatus` returns null when not enabled
- [ ] `getStatus` returns bot channel when enabled
- [ ] `enable` creates BotChannel record
- [ ] `enable` re-enables previously disabled channel
- [ ] `disable` sets enabled to false
- [ ] `updateCommandToggles` updates disabledCommands array
- [ ] `updateCommandAccessLevel` creates DefaultCommandOverride
- [ ] `updateCommandAccessLevel` deletes override when reverting to default

### L5. tRPC Regular Router Integration (6 tests)

- [ ] `add` creates TwitchRegular in DB
- [ ] `add` duplicate → CONFLICT (unique constraint)
- [ ] `add` throws NOT_FOUND for unknown Twitch user
- [ ] `remove` deletes regular from DB
- [ ] `list` returns all regulars ordered by createdAt desc

### L6. tRPC UserManagement Router Integration (6 tests)

- [ ] `updateRole` changes role in DB
- [ ] `updateRole` rejects self-change
- [ ] `updateRole` rejects changing broadcaster role
- [ ] `ban` sets banned flag and reason in DB
- [ ] `ban` rejects self-ban
- [ ] `unban` clears all ban fields

### L7. tRPC AuditLog Router Integration (5 tests)

- [ ] Broadcaster sees all audit entries
- [ ] Moderator only sees entries at their level and below
- [ ] Pagination works with real data
- [ ] Enriches entries with isChannelOwner flag
- [ ] Filters by action prefix

### L8. tRPC Setup Router Integration (4 tests)

- [ ] `status` returns false when no config exists
- [ ] `status` returns true when setupComplete configured
- [ ] `complete` with valid token finalizes setup (sets broadcaster, promotes user, deletes token)
- [ ] `complete` with invalid token throws FORBIDDEN

### L9. Twitch QueueManager Integration (15 tests)

- [ ] `getQueueStatus` defaults to CLOSED
- [ ] `setQueueStatus` persists status changes
- [ ] Status transitions between OPEN/PAUSED/CLOSED
- [ ] `join` creates entry with correct position
- [ ] `join` duplicate → rejected
- [ ] `join` when CLOSED → rejected
- [ ] `join` when PAUSED → rejected
- [ ] `leave` removes entry and reorders positions
- [ ] `leave` returns false for non-existent user
- [ ] `getPosition` returns correct position
- [ ] `pick("next")` picks lowest position
- [ ] `pick("random")` picks random entry
- [ ] `pick` by username (case-insensitive)
- [ ] `remove` by username with reordering
- [ ] `clear` removes all entries
- [ ] `listEntries` returns ordered entries

### L10. Twitch CommandCache Integration (8 tests)

- [ ] `load` loads enabled commands from DB
- [ ] `load` skips disabled commands
- [ ] `getByNameOrAlias` finds by name (case-insensitive)
- [ ] `getByNameOrAlias` finds by alias
- [ ] `getByNameOrAlias` returns undefined for non-existent
- [ ] `getRegexCommands` returns regex-type commands with compiled RegExp
- [ ] `reload` refreshes cache after DB changes
- [ ] Multi-channel isolation: commands separated per channel

### L11. Twitch AccessControl Integration (6 tests)

- [ ] `loadRegulars` loads from real DB
- [ ] `loadRegulars` refreshes when new regulars added
- [ ] `loadRegulars` removes deleted regulars
- [ ] `meetsAccessLevel` — EVERYONE/EVERYONE → true
- [ ] `meetsAccessLevel` — REGULAR/MODERATOR → false
- [ ] `meetsAccessLevel` — BROADCASTER meets all levels

### L12. Discord GuildCreate/Delete Integration (5 tests)

- [ ] `guildCreateEvent` creates DiscordGuild record
- [ ] `guildCreateEvent` handles duplicate guild gracefully
- [ ] `guildDeleteEvent` removes DiscordGuild record
- [ ] `guildDeleteEvent` handles non-existent guild gracefully
- [ ] Round-trip: create → delete → re-create works

### L13. Discord CheckTwitchStreams Integration (8 tests)

- [ ] `resolveNotificationChannelId` uses per-channel override
- [ ] `resolveNotificationChannelId` falls back to guild default
- [ ] `resolveNotificationChannelId` returns null when neither set
- [ ] `resolveRoleMention` formats @everyone
- [ ] `resolveRoleMention` formats role mention with ID
- [ ] TwitchChannel created with guild association and queried correctly
- [ ] Channels with disabled guilds are filtered out
- [ ] TwitchNotification records created and queried correctly
- [ ] Multiple guilds monitoring same channel both have records
- [ ] Stream status fields updated on TwitchChannel

### L14. Full Integration Suite Verification

- [ ] `docker compose up -d postgres` — PostgreSQL running
- [ ] `pnpm test:integration` — all ~95 integration tests pass
- [ ] `pnpm test` — all 395 unit tests still pass (no regression)
- [ ] Integration tests properly excluded from `pnpm test` via root `vitest.config.ts`
