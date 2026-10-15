# Dashboard design notes

Community Bot keeps the official MrDemonWolf wolf asset, navy `#091533`, and this project's cyan `#0FACED`. The dashboard uses light or dark work panels within a navy navigation shell. Forms and responsive grids use the shared Tailwind CSS pipeline; brand and interaction styling stay in the web stylesheets.

## References inspected in Mobbin

| Reference | Pattern used in Community Bot |
| --- | --- |
| [incident.io status dashboard](https://mobbin.com/screens/9618b478-1dc4-428c-b34d-5f4115112f4d) | Stable navigation, one page title, a prominent next-step/status notice, and a short component list. |
| [Supabase connection dashboard](https://mobbin.com/screens/2e0ffd2d-c588-4513-bd84-d3effa2e31ed) | Connection health grouped with the action that resolves it. Configured credentials and actual connected status remain distinct. |
| [Klaviyo onboarding flow](https://mobbin.com/flows/2f2f393a-73af-4efd-aa61-5683ed9d16bc) | Grouped setup tasks, visible progress, explicit completion, and one primary next action. Screens 1, 5, 8, and 12 were reviewed. |
| [Deel mobile dashboard](https://mobbin.com/screens/57446543-eb92-4709-858a-e083bb6efb5e) | A compact account header, status cards, and persistent bottom tabs with visible labels. |
| [Linktree More menu](https://mobbin.com/screens/eb247c38-04dc-4b14-81ef-a6c6f3efeabf) | Secondary tools and account destinations grouped into short navigation rows. |
| [MacroFactor More menu](https://mobbin.com/screens/3aedad23-65c2-4409-840b-406e1940c22a) | Small groups of related settings instead of a wall of unrelated controls. |
| [Chatbase integrations](https://mobbin.com/screens/9d24c903-7050-4e16-b34e-71da42107d2c) | Consistent integration cards with an icon, short purpose, connection state, and nearby action. |
| [OpenAI Platform service health](https://mobbin.com/screens/d605f83d-3869-4ecc-8874-b913e09e2930) | A quiet selected navigation row and restrained operational page hierarchy. |
| [Customer.io workspace performance](https://mobbin.com/screens/b9743841-5a29-4454-bc39-133d7b0d7d9c) | Consistent service rows, status labels, and spacing that groups related information. |
| [Plain account settings](https://mobbin.com/screens/72c9cfb4-253a-4499-87ec-8919a2755818) | Quiet secondary navigation grouped into personal account and workspace settings. |
| [Cofounder profile settings](https://mobbin.com/screens/ad24c6d9-5547-4c1c-b54f-05134df03c39) | Compact photo controls, clear source selection, and a nearby change-photo action. |
| [Featurebase appearance settings](https://mobbin.com/screens/49cb38ad-0981-4532-9b34-da53ece31d16) | Explicit Light, Dark, and System choices with restrained dark surfaces. |

These references informed hierarchy and flow. Community Bot retains its own branding and uses less density for a single creator.

The refinement uses a neutral filled navigation selection without a colored edge, a factual Overview heading, and a consistent 8px spacing scale. The stripe removal follows the creator's explicit visual preference; it is not presented as an accessibility rule. The evidence-backed review and limits are recorded in [the UI/UX review](uiux-review.md).

## Access and action hierarchy

- Personal account linking lives at `/access`, before privileged tools.
- The sidebar shows tools permitted by the person's platform-scoped roles.
- Desktop navigation and mobile tabs use the same permission-filtered destination definitions.
- The overview prioritizes service status and Join, Leave, and Mute controls. Configuration lives in Settings, rather than below every overview visit.
- Credentials, workspace profile, and staff mappings remain creator-only.
- Feature cards reuse the shared feature manifest and have independent platform switches.
- Reward setup separates creator authorization, admin configuration, and moderator queue actions.
- Saved settings never imply a completed provider action. Fresh heartbeats and provider-confirmed state supply that evidence.
- Personal pictures are separate from the application's official logo. Each owner, admin, or moderator chooses initials, a linked-account snapshot, or a cropped upload. Image access is private to that person's session, including when the public channel is enabled. The shared cropper and More menu reuse the same modal, focus management, and scroll locking.

## Phone behavior

The mobile shell uses a compact top bar and persistent bottom navigation: Home, Features, Rewards, and More. Features and Rewards appear only when the current roles allow them. More opens a grouped menu for settings, guided setup, staff access, personal accounts, the public page, and sign-out as permitted. Desktop keeps the sidebar. Neither layout reserves a large block of phone content for a full sidebar.

The More menu uses a native modal dialog with a visible close action, Escape dismissal, focus containment, and focus return to its trigger. Navigating closes the menu. Scrolling behind an open menu is locked. The tab bar includes the device safe area; content has matching bottom space so the last control remains reachable.

Forms and the reward queue stack vertically. Buttons and navigation links have a minimum 44px touch height; form text becomes 16px on phones to avoid focus zoom on iOS. Long identifiers and commands wrap within bounded panels. Shared page headings, panels, and status badges keep spacing and states consistent across overview, features, and settings.

Browser journeys at 360px and 390px should verify no document overflow, bottom-tab selection, More-menu opening and dismissal, account linking, feature controls, creator-only forms, and the rewards layout. The mobile journey also runs in WebKit with an iPhone touch profile. This note describes the design and acceptance criteria; browser artifacts and CI results provide verification.

## First setup

The creator sees three short steps: workspace, Discord, Twitch. Both connections are optional. Each form has an explicit save state. Staff members instead link an identity, see their role-check status, then open the dashboard only when their mapped permissions allow it.

## Appearance and personal settings

Appearance defaults to the operating system and follows system changes while System is selected. Light and Dark override that preference in this browser. The shared footer provides the same choice outside the dashboard. A pre-paint theme script and native CSS color scheme keep controls and initial rendering consistent; the public offline page reads the same preference without caching private pages.

Settings groups personal Profile picture and Appearance separately from permission-filtered Workspace controls. Its inner navigation follows the visible section. All forms stay mounted while navigating so unsaved inputs survive. Photo choices show the current source and explain unavailable linked accounts; the existing private image storage and compression limits still apply.
