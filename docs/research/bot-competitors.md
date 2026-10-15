# Bot dashboard and public command research

Reviewed October 15, 2026. Research only; no application changes or live account settings changed.

## Recommended direction

Make the public channel a compact, searchable command reference. Make the private dashboard a place to connect, check, and control the two bots. Their primary jobs are different, so their content order should differ.

## Evidence and limits

- **Observed UI:** actual Chrome accessibility trees, screenshots, and public search/filter controls. The Nightbot page displayed a Login button. Existing Fossabot and StreamElements browser sessions displayed an account menu; their public pages were inspected without opening account settings. Anonymous interactive behavior was not independently verified for those two services.
- **Documented:** official setup/control-panel documentation and official dashboard screenshots. These establish documented controls, not proof of the current authenticated dashboard's behavior.
- **Not verified:** authenticated dashboards, saving settings, mobile breakpoints, keyboard completeness, live bot responses, or competitor uptime/reliability. No login, bot join/leave, command modification, or other live mutation was performed.
- Browser screenshots were visually inspected in tool output. The local image paths below are downloaded official documentation screenshots, not captures of an authenticated dashboard. They should not be presented as our own product screenshots.

## Public page comparison

| Product and primary source | Observed viewer interface | Useful distinction |
| --- | --- | --- |
| [Fossabot public commands](https://fossabot.com/szkajpur/commands) | Creator picture/name and Twitch link above a command table. Search, role filter, sortable Name/Response/Enabled columns. Restricted roles appear under response text. Role filter exposed Moderator and Broadcaster. Searching `online/offline` retained the uptime row, confirming response-text matching. | Identity is compact; most content is the command reference. The Enabled column describes availability, not bot process health. Cooldowns and alias details were not visible in this inspected table. |
| [Nightbot public commands](https://nightbot.tv/t/ninja/commands) | Channel-specific title, Command/Message/User-Level table, search, page-size control, and pagination. Searching `discord` matched two command names and another row's message. Search persisted in the URL. Sidebar offers Commands and Song Requests. | A viewer can discover a command by its purpose rather than knowing its trigger. This inspected page did not expose a creator avatar, cooldown column, or a separate live-stream status card. |
| [StreamElements public commands](https://streamelements.com/nightbot/commands) and [profile](https://streamelements.com/nightbot) | Persistent creator identity and platform link; Profile/Commands navigation; search; All/Default/Custom tabs with counts; Command/Permissions/Response table; permission badges and alias-count buttons. The profile's main content linked to the associated platform channel. | Commands have their own destination. Alias controls are visible, but alias expansion behavior was not confirmed. A separate profile page with only a destination link adds little value for our smaller scope. |

These are individual channel examples, not an assertion that every competitor channel exposes identical content. Channel responses can contain templates; they are not verified live output.

## Private dashboard patterns from primary sources

### Nightbot: direct operational controls

[General Setup](https://docs.nightbot.tv/setup) documents a left navigation bar and a top-right Join action with moderation instructions. It also describes activity and usage statistics. Those statistics require actual recorded events; they are not a reason to invent dashboard counters here.

[Control-panel Commands](https://docs.nightbot.tv/control-panel/commands) documents separate default/custom command management, enable/disable controls, options, and edit/delete actions. Its command form includes name, message, user level, cooldown, and alias. Default command options expose access and cooldown rather than requiring users to edit a template.

### StreamElements: basic first, advanced on demand

[Getting Started](https://docs.streamelements.com/chatbot/getting-started) documents Custom commands, Add new command, a basic settings form, and a separate Advanced settings tab. The accompanying official screenshots show user level and response type alongside the response, then aliases, per-user/global cooldowns, live/offline conditions, and a public-list hiding checkbox in Advanced settings. Activation is explicit.

[Twitch chatbot setup](https://support.streamelements.com/hc/en-us/articles/18558305644050-StreamElements-Chatbot-on-Twitch) documents joining from Bot settings and granting moderator access. [Custom Commands](https://docs.streamelements.com/chatbot/commands/custom) distinguishes dashboard management from chat management. [Modules](https://support.streamelements.com/hc/en-us/articles/18750984334994-Chatbot-Modules) groups optional behavior under Chatbot modules, rather than requiring every feature to dominate the dashboard.

Official documentation screenshots inspected locally:

- `/tmp/community-bot-competitors/streamelements-dashboard-command-list.webp` — [original](https://docs.streamelements.com/_astro/step_1.Cho8_vHi_2sYDaK.webp)
- `/tmp/community-bot-competitors/streamelements-dashboard-command-form.webp` — [original](https://docs.streamelements.com/_astro/step_2.BRDLjp_S_ZokXUx.webp)
- `/tmp/community-bot-competitors/streamelements-dashboard-command-advanced.webp` — [original](https://docs.streamelements.com/_astro/command-advanced.BaVl27N2_Z1pxB21.webp)

### Fossabot: command work and scoped teamwork

The [official homepage](https://fossabot.com/) presents an illustrative dashboard with Custom/Default commands, row toggles and audit activity. Its examples document role-restricted commands and per-user cooldowns. These are vendor demonstrations, not an authenticated-dashboard inspection. The documentation root redirected to a new documentation site whose overview provided little substantive content in this research session; public UI and clearly labelled homepage evidence are stronger than assuming old dashboard layouts remain current.

## Five implementable recommendations

1. **Put commands first on the public channel.** Keep creator/channel name, a short description, and the real Twitch destination in a compact identity header. Put the command reference immediately afterward. Stream availability can be a small adjacent summary; operational service cards should not push the viewer's task down the page. This follows the observed command-first public pages without copying their unrelated donation, media, or commerce features.

2. **Add lightweight search with an honest empty state.** Search trigger and description, show the result count, and provide Clear search. For five built-ins, render all results with no pagination or Default/Custom tabs. A small Copy command action is useful only with clipboard success/failure feedback. This is possible with the existing public DTO and does not require a new service.

3. **Keep Overview operational and concise.** Show one Discord row/card and one Twitch row/card: real connection state, reported identity, freshness, and the permitted Join/Leave/Mute actions. A missing connection gets one setup destination. Put credentials in Settings and feature-specific controls in their feature page. Do not add analytics cards unless actual events are stored and measured.

4. **Separate personal setup from workspace administration.** Retain Account settings for picture/appearance and role-filtered Workspace settings for connections and bot configuration. Keep current-section navigation and existing mobile bottom navigation. Commands, rewards, and feature settings should lead to their own focused work areas, not an ever-growing Overview form.

5. **Expose only metadata the backend actually supports.** A future command reference can show platform, permission, cooldown and aliases, but those must come from a shared typed registry/public projection. The current public DTO exposes only command and description; do not invent columns or ship raw settings/response templates. Preserve the deliberate distinction between our bot `uptime` and `streamuptime`, explain it visibly, and group `botuptime` as an alias only when the shared model represents that relationship. Keep public-page opt-out and private personal pictures unchanged.

## Scope boundary

The strongest fit is a command reference plus two-platform operational dashboard. Competitor moderation suites, timers, loyalty economies, media requests, tipping and multi-channel switching are evidence of their broader products, not requirements for this single-creator bot. These recommendations are research conclusions; implementation and new light/dark/mobile screenshot verification remain separate work.
