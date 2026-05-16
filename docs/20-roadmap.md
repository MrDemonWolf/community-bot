# 20 — Roadmap (Phase 10+)

Stuff that's NOT MVP but is on the radar. Bottomless backlog lives in GitHub issues / Jira; this file holds the "yes we'll get there" items.

## Phase 10 — Song requests

YouTube IFrame + Spotify Web Playback. Both have ToS gotchas, especially for monetized streams. Research before building. Likely viewer-side: viewer hits a public `/songrequest` page that they paste a URL into. Broadcaster has a queue widget in OBS.

## Phase 11 — Giveaways

`!giveaway start <prize>` → opens a window. Viewers `!enter`. `!giveaway draw` → picks a winner. Configurable: subs-only, follower-required, watchtime threshold.

## Phase 12 — Raid AI (cross-stream)

When you raid OUT to another streamer: AI generates a custom pre-raid hype message referencing the target's last game/title. Bolts onto Phase 8 infra.

## Phase 13 — WolfWave integration

WolfWave is Nathanial's music platform (separate project). When ready: `!song` reads currently-playing track. Stream-side widget for incoming song requests.

## Phase 14 — VOD highlights AI

After stream offline: AI watches the VOD (using Gemini Vision) and suggests clip points. Mod confirms each. Each one auto-generates a clip + suggested title.

## Phase 15 — Mobile app (PWA → native)

PWA exists from day 1. Wrap as native app via Capacitor or Tauri when feature parity is solid.

## Phase 16 — Sponsorship dashboard

For when MrDemonWolf gets sponsorships: dedicated panel to track contract terms, deliverables, etc. Internal-only.

## Won't do (explicitly)

- Polls (Discord has them; not worth duplicating)
- Watch parties (out of scope)
- Welcome personaliser AI (consent + spam risk)
- Chat translate AI (out of scope)
- Weekly digest AI (out of scope)
- Emote insights AI (out of scope)
- Category suggester AI (out of scope)
- AI severity scorer for mod (DPIA risk + false-positive blowback)
- FAQ answerer AI (out of scope)
- X/Twitter integration (Nathanial said no)
- YouTube/Kick/TikTok/Bluesky live notifications (Twitch-only forever)
- AI mod team (Nathanial said no — humans only for moderation)
