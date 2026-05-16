# 10 — Roles & permissions

Six-role hierarchy. Stored as Postgres enum on `user.role`.

| Role | Who | What they can do |
|---|---|---|
| 🎬 **broadcaster** | Nathanial. Exactly one. Cannot be removed. | Everything. |
| ✏️ **editor** | Trusted team (none at launch). | Almost everything. Cannot: manage other editors, change billing, delete instance, see broadcaster tokens. |
| 🛡️ **moderator** | Twitch mods, Discord mods. | Mod actions, edit commands/timers/quotes/counters, view audit. Cannot: change settings, manage integrations/roles, run imports, change AI budget. |
| ⭐ **vip** | Promoted by broadcaster. | No dashboard. Chat filter exemption, cooldown bypass. |
| 💜 **subscriber** | Auto-synced from Twitch. | No dashboard. Chat perks per config. |
| 👀 **viewer** | Default. | Public `/commands`, `/leaderboard`, `/privacy/me`, `/den` (if also sub) only. |

"The Den" = subscriber/VIP-only Discord-linked page at `/den`.

## Permissions matrix — dashboard routes

| Route | broadcaster | editor | moderator | vip+ |
|---|:---:|:---:|:---:|:---:|
| `/setup` | one-time | ❌ | ❌ | ❌ |
| `/dashboard` | ✅ | ✅ | partial | ❌ |
| `/dashboard/commands` | ✅ | ✅ | ✅ | ❌ |
| `/dashboard/timers` | ✅ | ✅ | ✅ | ❌ |
| `/dashboard/moderation` | ✅ | ✅ | ✅ | ❌ |
| `/dashboard/audit` | ✅ | ✅ | ✅ (own actions only) | ❌ |
| `/dashboard/flows` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/import` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/addons/ai` | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/discord/*` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/roles` | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/settings` | ✅ | ❌ | ❌ | ❌ |
| `/dashboard/integrations` | ✅ | ❌ | ❌ | ❌ |
| `/privacy/me` | ✅ | ✅ | ✅ | ✅ |
| `/commands` (public) | ✅ | ✅ | ✅ | ✅ |
| `/leaderboard` (public, Phase 4) | ✅ | ✅ | ✅ | ✅ |
| `/den` | ✅ | ✅ (if also sub) | ✅ (if also sub) | ✅ (if sub) |

## Permissions matrix — bot/chat actions

| Action | broadcaster | editor | moderator | vip | sub | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `!addcom` / `!editcom` / `!delcom` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `!marker <text>` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `!clip` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `!commercial <s>` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `!vanish` (self) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `!points` / `!braincells` (self) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `!addpoints` / `!removepoints` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Link/word/caps filter exemption | ✅ | ✅ | ✅ | ✅ (config) | ✅ (config) | ❌ |
| Cooldown bypass | ✅ | ✅ | ✅ | ✅ (per cmd) | ❌ | ❌ |

## Implementation

### Schema

```ts
export const role = pgEnum('role', [
  'broadcaster',
  'editor',
  'moderator',
  'vip',
  'subscriber',
  'viewer'
]);

// On user table:
role: role('role').notNull().default('viewer'),
```

Plus partial unique index for one-broadcaster invariant:

```sql
CREATE UNIQUE INDEX idx_one_broadcaster ON "user" (role) WHERE role = 'broadcaster';
```

### Permission helper

`packages/shared/src/permissions.ts`:

```ts
export type Role = 'broadcaster'|'editor'|'moderator'|'vip'|'subscriber'|'viewer';

const HIERARCHY: Role[] = ['broadcaster','editor','moderator','vip','subscriber','viewer'];

export function hasRoleAtLeast(role: Role, min: Role): boolean {
  return HIERARCHY.indexOf(role) <= HIERARCHY.indexOf(min);
}

export function canExecute(action: string, role: Role): boolean {
  const requirements: Record<string, Role> = {
    'commands.create': 'moderator',
    'flows.publish': 'editor',
    'ai.budget.change': 'broadcaster',
    // ...
  };
  const req = requirements[action];
  if (!req) return false;
  return hasRoleAtLeast(role, req);
}
```

Used in every tRPC procedure as a middleware.

### VIP/Subscriber sync (Phase 6)

Twitch VIPs and subscribers don't directly map to Better-Auth users — they're identified by Twitch user ID. On EventSub events:

- `channel.vip.add` → upsert `userMeta.isVip = true` keyed by Twitch user ID, lookup `user` if account linked, set role to `vip` (if not already higher)
- `channel.subscribe` (or `subscription.message`) → mark sub, set role to `subscriber` (if currently `viewer`)
- `channel.subscription.end` → demote to `viewer` (with configurable grace period)

If account isn't linked: store in `userMeta.unlinkedTwitchId` so chat-side permissions still work even without dashboard access.

## Mod scope (chat)

Moderators have:

- Twitch mod permissions (timeout, ban, delete)
- Dashboard partial: read everything mod-related, edit commands/timers/quotes/counters, no settings
- Cannot change AI budget, sub-processors, integrations, roles
- Cannot promote other mods (broadcaster + editor only)
- Cannot see broadcaster auth tokens
- Cannot delete the audit log (it's append-only anyway)

## Promotion flow

Broadcaster (or editor) → `/dashboard/roles` → list of users with linked Twitch + Discord → assign role from dropdown → confirm dialog → audit row written → user's session invalidated forcing reauth with new role.
