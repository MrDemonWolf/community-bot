# ADR-004: Secret management

- Status: Accepted
- Date: Phase -1
- Authors: Nathanial (broadcaster)

## Decision

- One master `ENCRYPTION_KEY` (32 random bytes base64) in env
- Per-row AES-256-GCM encrypted columns for all third-party secrets (Twitch tokens, Discord bot token, Gemini API key, WeatherKit private key)
- Key versioning in ciphertext format `v1.<iv>.<tag>.<cipher>` allows rotation
- App refuses to start if `ENCRYPTION_KEY` missing or wrong length

## Why not Hashicorp Vault / AWS KMS / GCP KMS?

Single-streamer, self-hosted. Adding an external KMS doubles operational surface. The encryption key in env is acceptable if:

- VPS access is locked down (key auth, no password, fail2ban)
- Dokploy env vars are not exposed via the dashboard to non-broadcaster
- Env file backups are encrypted separately

## Rotation procedure

Quarterly. Documented in `docs/17-operations.md → Key rotation`.
