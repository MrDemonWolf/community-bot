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

## D. Automated Tests

- [ ] Run `pnpm test` — all 255 tests pass
- [ ] Run `pnpm check-types` — discord-bot, twitch-bot, docs pass (web has pre-existing unrelated type errors in `.next/dev/types/`)
- [ ] Run `pnpm turbo build --filter="!web"` — all builds succeed
