# Phase 6 — Role sync, account linking, The Den

**Goal:** Twitch and Discord identities link to a single `userMeta` row. Role membership (sub, VIP) syncs both directions. Subs get access to `/den` page.

---

## Scope — IN

### Account linking

- [ ] `userMeta` table holds: `id` (PK), `twitchId`, `twitchLogin`, `discordId`, `displayName`, `email`, `role` enum, `linkedAt`
- [ ] One row per human; both `twitchId` and `discordId` nullable but unique
- [ ] Link flow: viewer logs into dashboard via Twitch OAuth → prompted to link Discord OAuth → merge or create row
- [ ] `!link` Twitch chat command — generates a one-time link code, DMs in Discord to claim
- [ ] `/link` Discord slash command — same flow, opposite direction
- [ ] Unlink: viewer can unlink in dashboard; preserves audit but clears the foreign ID

### Role sync

- [ ] Twitch sub event → assign mapped Discord role (from setup wizard step 6)
- [ ] Twitch sub expires → revoke Discord role
- [ ] Twitch VIP add → assign Discord VIP role
- [ ] Twitch VIP remove → revoke
- [ ] Twitch ban event → bot does NOT auto-ban from Discord (intentional: cross-platform ban is a mod decision)
- [ ] Discord role change UI in dashboard for broadcaster (manual override)
- [ ] Reconcile job: hourly cron checks Twitch sub list vs Discord role membership, fixes drift

### The Den

- [ ] `/den` page in dashboard
- [ ] Auth: must be linked, must have active sub (verified via Helix `getSubscriptionForUser` on each visit, cached 5 min)
- [ ] Content: sub-only announcements feed, sub count, sub anniversary, broadcaster's personal sub-only blog posts
- [ ] `denPosts` table: title, body (markdown), authorRole, createdAt, deletedAt
- [ ] Only broadcaster can post; mods can comment
- [ ] Comments on den posts (subs can comment; broadcaster can moderate)

### Misc

- [ ] Discord bot configurable activity rotation now also pulls from "currently streaming" status when live

## Scope — OUT

- ❌ Cross-platform mod actions (Phase 3 covered single-platform)
- ❌ Sub-only role rewards beyond Den (post-MVP)

---

## Acceptance criteria

1. Twitch login → Discord prompt → click → user row has both IDs
2. Sub on Twitch → Discord role granted within 60s
3. Sub lapses → Discord role revoked within 1 hour (cron drift fix)
4. `/den` blocked for non-subs with clear message
5. `/den` works for subs
6. Broadcaster creates Den post → visible to subs only

## Test plan

- Unit: link code lifecycle
- Integration: simulate sub/unsub events, assert Discord role state
- E2E: full link flow + Den access

## Run plan

Same as previous phases.

---

## Risks

- **Discord role grant rate limit** — Discord 50 actions/sec global; mass sub event (e.g., gifted 100 subs) needs queueing
- **Helix sub check rate limit** — cache per visitor, 5-minute TTL
- **Race: viewer subs then immediately visits /den** — write-through cache invalidation

## Definition of Done

PR merged. Tag `v0.6.0-roles-and-den`.
