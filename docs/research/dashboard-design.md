# Community Bot: operations dashboard research

Research date: October 15, 2026. Scope: information architecture, operational states, integration controls, and visual hierarchy. This is a research recommendation, not an implemented redesign.

## Direction

Build a small control room for one creator: connection state first, a specific next action second, community tools third. Use the actual MrDemonWolf website design system, fonts, assets, and color tokens throughout. Mobbin supplies functional patterns only; its palettes, logos, product chrome, and analytics are not the visual system for this project.

The root agent's website-source audit identifies Montserrat 500 for headings, Roboto 400 for body text, and JetBrains Mono for code. Brand colors are navy `#0A1633`, sky `#3AAEE3`, and deep text `#0D4D8C`. Actual dark website surfaces are neutral charcoal: background `#151719`, card `#22262A`, alternate `#1B1E21`, primary text `#F4F5F6`, body `#C9CDD2`, muted `#9AA2AA`, border `#343A40`, and accent text `#6BC8F6`. Apply those semantic roles rather than turning every dark surface navy. Use a quiet filled navigation selection without a left stripe.

## Current evidence

Inspected the actual desktop and mobile Overview and public-channel exports in `/Users/nathanialhenniges/Developer/_local-previews/community-bot-6bac897/app-images/`.

- Overview repeats setup in the page-level Settings button, setup banner, explanatory text in both connection cards, and two setup buttons. The user must scan several equal-weight surfaces to discover the same next step.
- The disconnected cards present disabled Join, Leave, and Mute controls alongside their useful setup action. This exposes implementation possibilities before they are actionable.
- Both cards reserve substantial height for very little state information. On the mobile capture, the first bot occupies most of the space before the second bot becomes visible. The long command reference and duplicated workspace links then extend the page considerably.
- The public page correctly distinguishes unknown stream state from offline, and does not expose staff identity. Its generous cards repeat the private dashboard's operational language. A viewer needs channel identity, available commands, and a clear current stream state rather than an administration layout.
- The fixed bottom bar appearing partway down a stitched full-page capture is not evidence of broken positioning; viewport captures and interaction tests remain necessary.

## Strongest references

These are actual returned Mobbin screens, inspected visually. Downloaded files are full-resolution references outside the repository. Canonical links remain useful after temporary image URLs expire.

| Reference | Observed pattern | Transfer to Community Bot | Do not copy |
| --- | --- | --- | --- |
| [Resend: pending domain verification](https://mobbin.com/screens/6f41111b-5a31-4d83-a3fa-ec3f2064a957) | Identity heading, compact status metadata, one state-specific explanation, then verification details | Show bot identity, desired connection, observed health, and the specific missing authorization together | DNS table, event timeline without recorded events, Resend palette |
| [Railway: service deployment detail](https://mobbin.com/screens/8907c9da-f513-4722-9f19-826602c11429) | Service identity remains visible beside observed Online state; current deployment actions sit directly beside that deployment | Keep each bot's action beside its actual state; use concise secondary details rather than an oversized empty card | Infrastructure canvas, database topology, deployment history absent from our data |
| [Plane: GitHub integration detail](https://mobbin.com/screens/5a24430d-f6c0-46f5-b111-5af0b2cade9a) | Workspace connection and personal account linking are separate rows with their own explanations and actions | Separate creator/application configuration from personal staff account linking; distinguish Twitch creator account from bot account | Another nested settings sidebar or GitHub-specific concepts |
| [incident.io: closed incident with open actions](https://mobbin.com/screens/088f58fa-8a26-468d-8f31-dfb977214d16) | A state contradiction produces a targeted warning and a direct corrective action above the work list | Explain stale heartbeat, revoked authorization, or requested connection not yet achieved with one relevant action | Incident lifecycle, severity, or a fabricated activity feed |
| [Twitch: Stream Manager](https://mobbin.com/screens/6460a676-e869-4107-9793-c8bbc5b54061) | Current broadcast state, active workspace, and quick actions are distinct regions; unavailable actions visibly differ | Prioritize the few controls a creator needs during a stream, with honest unavailable/unknown states | Stream preview, live chat moderation, analytics counters, resizable dock machinery that this bot does not provide |

Local evidence:

- `/tmp/community-bot-mobbin-research/resend-verification.webp`
- `/tmp/community-bot-mobbin-research/railway-service.webp`
- `/tmp/community-bot-mobbin-research/plane-integration.webp`
- `/tmp/community-bot-mobbin-research/incident-state-action.webp`
- `/tmp/community-bot-mobbin-research/twitch-stream-manager.webp`

## Additional comparisons

[Sentry's dark dashboard](https://mobbin.com/screens/ac81ee7f-550f-4395-aafe-13da3dc10e05) establishes a clear distinction between navigation, filters, and data panels. Its chart-heavy density is inappropriate for a bot with no historical analytics. [Linear's inbox](https://mobbin.com/screens/8337813e-f0dd-4415-8a29-87c114b0442b) keeps a compact actionable list beside selected detail; retain the list discipline, not a three-column shell for two services. [Render's services overview](https://mobbin.com/screens/3e106d4a-c875-45d5-be51-387a519355f8) is an especially useful comparison for concise name/status/details rows.

Seven deep searches covered Sentry operations, integrations, incident handling, Linear inbox, Railway service management, Resend verification, and Twitch creator moderation. Results were evaluated by actual app identity: the integration query returned Plane/Eventbrite/1Password/Charma rather than Vercel, and the Railway query also returned Render and Vercel. No claims depend on an app name merely appearing in a query. Substack and Buffer were not reused.

## Prioritized redesign specification

1. **Make connection state the first task.** Place Discord and Twitch immediately below the page heading in one compact connections surface, with distinct service rows. Each row contains platform, identity or Not configured, actual runtime state, concise detail, and one primary action. Two columns are acceptable on wide screens if both retain comparable information density; mobile must show both service summaries before the long command reference.
2. **Make state actionable.** Unconfigured gets Set up Discord/Twitch; configured and paused gets Join; connected gets Pause/Leave as appropriate; revoked authorization gets Reconnect account; stale health explicitly says Waiting for worker or Status unavailable. Desired pause and observed offline remain separate concepts. Preserve Discord's existing pause behavior without implying that it leaves a guild.
3. **Remove repeated onboarding surfaces.** A compact attention area appears only when there is a specific unresolved task. Link directly to its settings section. A single dismissible or completed setup checklist may help initial configuration; it must not dominate normal use.
4. **Give frequent tools clear destinations.** Keep Features and Channel points directly reachable. Use reward/queue counts only when existing APIs provide real values. Staff access and Settings remain secondary administration destinations. My accounts remains personal, separate from creator credentials. Preserve role filtering on every link and action.
5. **Reduce Overview reference content.** Keep a short Commands preview with a route or disclosure for the full list. Avoid repeating every navigation destination in a second large panel unless it adds actionable context. Keep command availability truthful when a feature is disabled.
6. **Organize settings around connection tasks.** Keep all current safeguards and forms; visually group application credentials, creator authorization, bot authorization, and personal identities with their own current states. Display configured/secret saved instead of revealing saved credentials. Prefer a short in-page section list over adding another permanent application sidebar.
7. **Treat the public page as a viewer surface.** Use website-branded channel identity, truthful stream state, compact service availability, and a scannable command list. Avoid setup CTAs, admin diagnostics, private avatars, invented stream metadata, or timestamps whose operational meaning viewers cannot interpret.

## Acceptance criteria for the design phase

- At 390px, identify both platforms and the next useful action without scrolling past a large onboarding hero or a command table.
- At 1440px, identify platform state, linked identity, and corresponding action without reading multiple cards or unrelated help paragraphs.
- No empty chart, invented engagement metric, undocumented activity feed, or decorative topology.
- Use website tokens consistently in light, dark, and system themes. Cyan is an intentional brand/action accent, not a border on every surface. The user's preference against decorative left stripes remains authoritative.
- Preserve clear keyboard focus, 44px primary touch controls, explicit labels, truthful unknown states, and existing offline/private-data boundaries.
- Validate actual connected, paused, unconfigured, authorization-needed, and stale-worker states; the current screenshot fixtures mainly show disconnected states.

Implementation should start after the research directions are combined and the website token audit is complete. These screenshots establish existing behavior and reference patterns, not proof that the proposed redesign works.
