# Dashboard design notes

Community Bot keeps the official MrDemonWolf wolf asset, navy `#091533`, and this project's cyan `#0FACED`. The dashboard uses light work panels within a navy navigation shell. Forms and responsive grids use the shared Tailwind CSS pipeline; brand and interaction styling stay in the web stylesheets.

## References inspected in Mobbin

| Reference | Pattern used in Community Bot |
| --- | --- |
| [incident.io status dashboard](https://mobbin.com/screens/9618b478-1dc4-428c-b34d-5f4115112f4d) | Stable navigation, one page title, a prominent next-step/status notice, and a short component list. |
| [Supabase connection dashboard](https://mobbin.com/screens/2e0ffd2d-c588-4513-bd84-d3effa2e31ed) | Connection health grouped with the action that resolves it. Configured credentials and actual connected status remain distinct. |
| [Klaviyo onboarding flow](https://mobbin.com/flows/2f2f393a-73af-4efd-aa61-5683ed9d16bc) | Grouped setup tasks, visible progress, explicit completion, and one primary next action. Screens 1, 5, 8, and 12 were reviewed. |

These references informed hierarchy and flow. Community Bot retains its own branding and uses less density for a single creator.

## Access and action hierarchy

- Personal account linking lives at `/access`, before privileged tools.
- The sidebar shows tools permitted by the person's platform-scoped roles.
- Credentials, workspace profile, and staff mappings remain creator-only.
- Feature cards reuse the shared feature manifest and have independent platform switches.
- Reward setup separates creator authorization, admin configuration, and moderator queue actions.
- Saved settings never imply a completed provider action. Fresh heartbeats and provider-confirmed state supply that evidence.

## Phone behavior

Navigation becomes a two-column list, retaining every available destination without a hidden menu. Forms and the reward queue stack vertically. Buttons and navigation links have a minimum 44px touch height; form text becomes 16px on phones to avoid focus zoom on iOS. Long identifiers and commands wrap within bounded panels.

A 390px browser journey should verify no document overflow, account linking, feature controls, creator-only forms, and the rewards layout. This note describes the implementation and acceptance criteria; browser artifacts and CI results provide verification.

## First setup

The creator sees three short steps: workspace, Discord, Twitch. Both connections are optional. Each form has an explicit save state. Staff members instead link an identity, see their role-check status, then open the dashboard only when their mapped permissions allow it.
