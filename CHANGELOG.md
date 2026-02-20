# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **`!commands` default command** — Sends a link to the public commands page in Twitch chat. Requires the `WEB_URL` environment variable on the Twitch bot.
- **`WEB_URL` environment variable** — Optional env var for the Twitch bot to configure the web dashboard URL used by `!commands`.
- **CHANGELOG.md** — This file to track changes going forward.

### Changed

- **Public routes renamed** — `/public`, `/public/commands`, and `/public/queue` shortened to `/p`, `/p/commands`, and `/p/queue` for more concise chat links.
- **Health endpoint bot checks are now informational** — Bot service checks (Discord WebSocket, Twitch chat) no longer affect the HTTP status code. Only infrastructure failures (database, Redis) cause a 503 response. This prevents unnecessary container restarts when only the bot connection is temporarily down.
