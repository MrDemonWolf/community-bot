# 11 — The Den (sub-only page)

A subscriber-and-VIP-only page on the public dashboard. Phase 6 ships an MVP.

## Route

`/den`

## Auth

- Twitch OAuth required (so we have the Twitch user ID)
- Helix call: `helixClient.subscriptions.getSubscriptionForUser(broadcasterId, viewerId)` — cached 60s
- If active sub OR vip OR moderator-or-higher → allow
- Else → redirect to `/den/locked` with a "subscribe to view" message

## Content (Phase 6 MVP)

- **Upcoming streams** — manual entries from `settings.streams.upcoming[]` (broadcaster-editable) OR pull from Twitch schedule API if available
- **Recent sneak peeks** — Markdown posts from a `denPosts` table (broadcaster-only edit)
- **Brain Cells leaderboard (subs-only view)** — shows top 50 subscribers
- **Discord link** — invite link to subscriber-only Discord channel

## Schema (Phase 6)

```ts
export const denPosts = pgTable("den_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(), // markdown
  publishedAt: timestamp("published_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  authorId: text("author_id").references(() => user.id),
  pinned: boolean("pinned").notNull().default(false),
  category: text("category"), // 'sneak-peek' | 'schedule' | 'poll' | 'meta'
});
```

## Later additions (Phase 9+)

- Sub-only polls
- Sub-only file downloads (Supabase Storage signed URLs)
- Sub-only voice chat invites (Discord)
- Birthday wishes / shoutouts
