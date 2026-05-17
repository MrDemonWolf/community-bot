# 14 — Hardening (Phase -1 detail)

Foundation security work. Done once. Every later phase inherits these.

## Threat model (lightweight)

- **Insider threat:** a compromised mod could try to delete logs, exfiltrate viewer data, plant a backdoor flow.
- **External attacker:** stolen Twitch OAuth, leaked Gemini key, compromised VPS.
- **Operator mistake:** Nathanial running a destructive command on prod, or losing the `.p8` WeatherKit key.

## Mitigations

### Audit log append-only

```sql
CREATE OR REPLACE FUNCTION audit_logs_no_modify() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_block_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();

CREATE TRIGGER audit_logs_block_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();
```

Only purge job (pg_cron, retention-bound) can delete, and it does so by partition drop, not row delete. Phase 9 implements partitioning.

### Secrets at rest

Master key `ENCRYPTION_KEY` from env (32 random bytes base64). App refuses to start if missing.

`packages/shared/src/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_VERSION = 1;
const ALGO = "aes-256-gcm";

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(KEY_VERSION), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${KEY_VERSION}.${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decrypt(blob: string): string {
  const [versionPart, ivB64, tagB64, encB64] = blob.split(".");
  const version = Number(versionPart.replace("v", ""));
  const decipher = createDecipheriv(ALGO, getKey(version), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString(
    "utf8",
  );
}
```

Key versioning: support `v1`, `v2`, ... → rotation without breaking old data.

### Rate limiting

- API routes via Hono middleware
- AI calls via pgmq queue rate limiter (built into `packages/jobs`)
- Per-user chat command cooldowns enforced in-memory

### Strict CSP

`apps/web` ships strict Content Security Policy. Detailed in `apps/web/src/server/headers.ts`.

### SECRET_KEY rotation

Documented in `docs/17-operations.md`. Quarterly:

1. Generate new `ENCRYPTION_KEY` (32 random bytes base64)
2. Add as `ENCRYPTION_KEY_V2`
3. Update `KEY_VERSION = 2` in code, deploy
4. Background job re-encrypts all rows under v2
5. Drop `ENCRYPTION_KEY_V1` after verifying all rows migrated

### Backups

Daily Postgres dump → S3-compatible storage. Restore test every quarter (in `docs/17-operations.md`).

### Token storage

Twitch refresh tokens, Discord bot token, WeatherKit private key, Gemini API key — all encrypted columns. **Never** in `.env` after Phase -1 finishes the migration.

### CI requirements

Every PR must pass:

- Typecheck (`bun --filter='*' typecheck`)
- Lint (`bun --filter='*' lint`)
- Test (`bun --filter='*' test`)
- Build (`bun --filter='*' build`)
- DB migration dry-run
- `bun audit --audit-level=high` (security)
- Secret scanning (`gitleaks` action)

## RBAC enforcement points

Every privileged action checks role at:

1. tRPC procedure middleware (`requireRole('moderator')`)
2. UI route loader
3. DB row-level security (RLS) where Supabase auth applies

Defense in depth.

## Sessions

Better-Auth session: HttpOnly, Secure, SameSite=Lax, 30 day max-age, sliding expiration.

On role change: invalidate all sessions for that user, force reauth.

## 2FA

Better-Auth supports TOTP. Required for `broadcaster` + `editor` roles. Optional for `moderator`.

## Bot-side rate limits

- Twitch chat: max 100 msg/30s (mod), 20 msg/30s (regular) — bot account should be moderator
- Discord chat: respect Discord's per-channel rate limits (5/5s)
- AI: per-feature limit in `packages/ai/queue.ts`

## Idempotency

Every pgmq job has `idempotencyKey` in payload. Workers SELECT FOR UPDATE on a `processed_keys` table before doing the work. Replays are no-ops.

## Logging

Structured JSON to stdout. No PII. Correlation IDs propagate via tRPC + queue payloads.

`packages/shared/src/logging.ts` wraps Pino with redactions for known PII fields.
