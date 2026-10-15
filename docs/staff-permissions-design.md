# Platform permissions

Nathanial selected implementation now with **automatic access from explicitly mapped platform roles**. There is no per-person approval queue. Google authenticates a dashboard account; explicitly linked Twitch and Discord identities establish its platform roles. Checked against official documentation on October 15, 2026.

## Access rules

| Role | Allowed actions on its granted platform |
| --- | --- |
| Owner | All actions; ownership remains the exact verified `OWNER_EMAIL` |
| Admin | Staff dashboard, mute, join/leave, redemptions, features, Discord presence |
| Lead moderator | Staff dashboard, mute, join/leave, redemptions |
| Moderator | Staff dashboard, mute, redemptions |
| VIP | VIP command perks; no dashboard controls |
| Subscriber | Subscriber command perks; no dashboard controls |
| Viewer | Public commands; no dashboard controls |

Credentials, broadcaster/bot connections, staff mappings, and workspace-wide name/prefix/public settings remain owner-only. A grant applies to its explicit target platform. Roles from separate identities combine; subscriber and VIP perks are independent rather than a rank hierarchy. UI controls and direct API requests use the same `@community-bot/core/permissions` capability policy.

The initial uptime and command-list commands are public. VIP, subscriber, and restricted command capabilities are available for future features; no exclusive perk command is included yet.

Only the owner creates source mappings. No mappings, implicit Admin grants, or cross-platform grants are seeded. The UI can offer an explicit Twitch starter preset mapping moderator, lead moderator, VIP, and subscriber to the same Twitch role. Any cross-platform mapping must be deliberately selected by the owner.

## Identity linking

Verified Google users may sign in. Without staff dashboard capabilities, they see `/access` to link their own identities and inspect the result. They cannot inspect service configuration or operate bot controls. Platform accounts are never inferred from matching email addresses, display names, chat messages, or browser-provided role labels.

Staff identity endpoints are separate from owner broadcaster/bot connections:

- `/api/identity/connect/twitch` and `/api/identity/callback/twitch` use public Twitch identity with no extra scope.
- `/api/identity/connect/discord` and `/api/identity/callback/discord` request `identify guilds.members.read`.
- OAuth state is bound to provider, user, session, app configuration, and a ten-minute server nonce. Successful linking consumes the nonce; unlinking invalidates pending attempts. Conditional database writes prevent configuration changes or disconnects being undone by delayed callbacks.

Each provider user ID can belong to only one Google dashboard account. Tokens use the existing application encryption; they never appear in client responses. Google remains the login method. Platform OAuth proves identity and current permission evidence rather than becoming an alternate dashboard sign-in method.

## Twitch sources and limits

Using the creator's user token, role sync checks the linked user's numeric ID through these filtered read endpoints:

| Source | Endpoint | Creator scope |
| --- | --- | --- |
| Moderator | `GET /helix/moderation/moderators` | `moderation:read` |
| VIP | `GET /helix/channels/vips` | `channel:read:vips` |
| Subscriber | `GET /helix/subscriptions` | `channel:read:subscriptions` |

The creator must reconnect to consent when enabling role sync. Staff users do not need those creator scopes. The bot retains its chat scopes. The optional Channel Points feature separately needs creator `channel:manage:redemptions`; this does not confer native moderation-management rights. [Twitch API reference](https://dev.twitch.tv/docs/api/reference/), [scope reference](https://dev.twitch.tv/docs/authentication/scopes/)

Twitch introduced a `lead_moderator` chat badge, but lead moderators may choose the ordinary moderator badge. Badge presence can be positive evidence for that individual chat message; it is not a reliable list or revocation mechanism. The current documented API has no native Lead Moderator listing endpoint. Community Bot therefore offers **owner-configured lead moderator IDs, intersected with the current verified moderator list**. The UI must call this a Community Bot lead designation, rather than claiming automatic native Lead Moderator detection. [Official Twitch announcement](https://discuss.dev.twitch.com/t/lead-moderator-role-and-chat-badge-introduced/64488), [documented moderator endpoint](https://dev.twitch.tv/docs/api/reference/#get-moderators)

Twitch EventSub message badges can support subscriber/VIP/moderator checks for that authenticated message on its channel. Persistent dashboard roles use REST verification, not remembered chat badges. Shared Chat source badges must not confer privileges in a different channel. [EventSub message reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#channel-chat-message-event)

## Discord sources

Staff role checks call `GET /users/@me/guilds/{configuredGuildId}/member` with the linked user's OAuth token and compare returned role IDs to owner mappings. Unfinished membership screening does not grant access. This avoids the privileged bot `GUILD_MEMBERS` intent. The owner dropdown can retrieve role names from the bot REST guild-roles endpoint, but authorization matches immutable role IDs, not role names, hierarchy, or Administrator flags. [Current-user member endpoint](https://docs.discord.com/developers/resources/user#get-current-user-guild-member), [guild member object](https://docs.discord.com/developers/resources/guild#guild-member-object), [Gateway intents](https://docs.discord.com/developers/events/gateway#privileged-intents)

The Discord client secret is saved through owner-only integration configuration. No full guild-list, email, guild-join, or native role-management scope is needed for staff identity checks.

## Expiry and failures

`packages/api/src/access.ts` resolves access per authenticated request. Successful source evidence is cached for at most 60 seconds. Cache keys include linked tokens, source mappings, app configuration, channel/guild, sync toggles, and lead IDs. Removing an identity or mapping invalidates the key immediately on the next request, including existing browser sessions. Roles in cookies are never authoritative.

Expired evidence must be refreshed before an action. Invalid tokens, missing consent, provider errors, and rate limits fail closed for the affected provider. No last-known permission is extended during an outage. Token refresh writes compare the previous encrypted token so a disconnected identity cannot reappear. Sync works independently of chat Join/Leave.

Twitch requires token validation at startup and hourly while maintaining an OAuth session; role queries and user-identity queries also reject invalid/revoked credentials. `user.authorization.revoke` does not support WebSockets: instant revocation callbacks would require a webhook/conduit addition. This implementation promises bounded verification, not instant native-role revocation. [Token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [authorization revocation event](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#userauthorizationrevoke)

## Implementation surfaces and checks

Existing Better-T-Stack, PostgreSQL, Next.js, and split workers remain. New `platformIdentity` and `permissionMapping` tables hold encrypted links and explicit mappings; existing verification rows hold one-time link attempts. The API exposes self access/link management and owner-only mapping/sync management. No provider roles are granted or changed by this system.

- [x] Exercise direct tRPC denial and platform isolation with authenticated fixture sessions.
- [x] Verify filtered upstream evidence, role union, cache expiry, revoked tokens, and missing consent with mocked providers.
- [x] Verify access invalidation after unlink, mapping changes, and sync disable.
- [x] Verify state comparison, unique identity constraints, one-time nonce consumption, unlink races, and superseded callbacks with unit/DB fixtures.
- [x] Verify redacted staff projections and owner-only credentials/workspace/mapping controls with direct API fixtures.
- [ ] Exercise HTTP and browser staff flows with real Google/provider sessions.
- [ ] Exercise real Google/provider consent and one mapped staff account before deploying role sync.

Live provider consent and native-role behavior remain separate from fixture test results. Lead designation is an explicit supported fallback until Twitch documents a suitable native API.
