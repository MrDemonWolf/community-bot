# Changelog

Changes are grouped by release. Work under **Unreleased** is on the rewrite branch and has not been deployed to production.

## Unreleased

### Added

- A single-creator Next.js dashboard for independent Discord and Twitch workers.
- Better Auth Google login, explicitly enabled local development login, and platform-scoped staff permissions.
- Dashboard setup for encrypted bot credentials, Discord status, and quick connection controls.
- Twurple EventSub and Helix integration, uptime commands, and Channel Point reward management.
- Shared feature, command, and permission definitions across the dashboard and workers.
- Personal staff pictures from linked Twitch/Discord accounts or a built-in upload cropper, with compressed storage below 1 MB per person.
- Mobile bottom navigation, a grouped More menu, shared skeleton loaders, and action spinners.
- Light, Dark, and System appearance preferences shared by settings, the footer, and the public offline page.
- An opt-in public channel page and an installable PWA with a public offline page.
- Public Privacy Policy and Terms of Service pages, essential-cookie information, and a footer linked to the deployed source commit.
- Beginner guides for local development and Dokploy, plus Docker/database/browser CI checks.

### Changed

- Rebuilt on Better-T-Stack with Bun, Next.js, tRPC, Better Auth, Drizzle, and PostgreSQL.
- Kept **community-bot** as the project name. WolfAide identifies connected bot accounts.
- Moved platform configuration into the dashboard and split Discord and Twitch into separate processes.
- Replaced the sidebar's selected-item stripe with a neutral background and improved spacing.
- Grouped personal and workspace settings, with section-aware navigation and clearer profile photo controls.
- Documented security, queue, token-refresh, and accessibility invariants in developer comments.

### Removed

- The former bot implementation and TMI/IRC chat connection. An external private local backup preserves the old repository.

### Deployment notes

- This rewrite needs a fresh PostgreSQL database. Its migrations do not upgrade the former Supabase schema.
- Production uses Google login and HTTPS. Development login remains unavailable in production.
- Live platform authorization and production rollout are separate from automated tests, which use mocked provider traffic.
