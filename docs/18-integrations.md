# 18 — Third-party integrations

## Currently planned

| Integration | Phase | Auth | Notes |
|---|---|---|---|
| Twitch (Helix + EventSub + Chat) | 1/2 | OAuth | Refresh tokens encrypted |
| Discord (gateway + REST) | 1 | Bot token | Token encrypted |
| Supabase (DB + Realtime + Storage + Auth via Better-Auth) | -1 | Service role key | Self-hosted via Dokploy |
| Apple WeatherKit | 2+ Later | JWT (ES256) | 500K req/mo (Nathanial's ADC) |
| Google Gemini | 8 | API key | Paid tier from day 1 |
| GitHub | release | Personal access token | For releases / GHCR push |
| Sentry | 9 (optional) | DSN | Error tracking |

## Explicitly excluded

- **X/Twitter API** — Nathanial said no. Any `${lasttweet}` template variable is flagged in import + replaced with empty string.
- **YouTube live notifications** — out of scope (Twitch-only forever per Phase 6 doc)
- **TikTok live notifications** — out of scope
- **Kick live notifications** — out of scope
- **Bluesky live notifications** — out of scope
- **Spotify Web Playback** — out of scope until WolfWave integration (Phase 10+)

## Integration registry

`packages/shared/src/integrations/registry.ts` lists every integration with metadata:

```ts
export const INTEGRATIONS = {
  twitch: { name: 'Twitch', authType: 'oauth', scopes: [...], requiredPhase: 1 },
  discord: { name: 'Discord', authType: 'bot-token', requiredPhase: 1 },
  weatherkit: { name: 'Apple Weather', authType: 'jwt-es256', requiredPhase: 2, optional: true },
  gemini: { name: 'Google Gemini', authType: 'api-key', requiredPhase: 8, optional: true },
} as const;
```

Dashboard `/dashboard/integrations` renders from this registry.

## OAuth state validation

All OAuth flows (Twitch, Discord) use Better-Auth's CSRF state. Never accept callbacks without matching state. Better-Auth handles this; don't bypass.

## Webhook signatures

If we ever accept incoming webhooks (Phase 5+ flow triggers), every endpoint validates:

- HMAC signature with shared secret (rotateable per-webhook)
- Timestamp within ±5min (replay protection)
- Idempotency key dedup
