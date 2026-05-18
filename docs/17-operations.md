# 17 — Operations

How to run this thing day-to-day.

## On-call

Single-streamer self-hosted bot → Nathanial is on-call. Discord webhook alerts to a private channel for critical events.

## Common runbook entries

### Bot won't connect to Twitch chat

1. Check Twitch token validity in `/dashboard/integrations`. Re-auth if expired.
2. Check IRC capability subscriptions in logs.
3. Verify bot account isn't banned/timed out from broadcaster's channel.

### Discord bot offline

1. `dokploy logs community-bot:discord --tail 100`
2. Verify gateway intents toggled in Discord Dev Portal (Members, MessageContent, Presences)
3. Verify bot token valid

### EventSub WS disconnects repeatedly

1. Check Twitch auth token scopes — missing scope causes silent revocation
2. Verify network egress isn't blocked
3. Inspect `events` table for last event timestamp — if old, something's wrong

### Migration fails mid-deploy

1. Dokploy rollback to last image
2. SSH in, restore DB to last backup
3. Reproduce migration locally against staging
4. Fix forward in a new migration; never edit applied migrations

### `audit_logs` is huge

1. Partition exists? (Phase 9 ships partitioning). Drop oldest partition.
2. Otherwise: extend `auditLogsDays` retention purposely; OR archive old rows to cold storage.

### Key rotation (quarterly)

1. Generate new `ENCRYPTION_KEY_V2` (32 random bytes base64)
2. Add to env alongside `ENCRYPTION_KEY` (which is v1)
3. Deploy with code change: `KEY_VERSION = 2`
4. Run background job: re-encrypt all secret columns
5. After verification, remove v1 key from env

### Restore-from-backup drill (quarterly)

1. Spin up empty Supabase project
2. Pull latest backup from S3
3. Restore + apply migrations
4. Verify schema + sample data
5. Document time-to-restore in `docs/restore-drill-log.md`

## Releases

`main` is the trunk branch. Phase work merges in via PR from feature branches. No `develop` branch.

When a phase is complete + tested:

1. PR `phase-X/<feature>` → `main`
2. Squash-merge after CI green + 1-hour cool-down (self-review for solo work)
3. GitHub Actions builds + pushes images to GHCR
4. Dokploy webhook redeploys
5. Verify via smoke test
6. Tag `vX.Y.Z-<name>` on `main` after merge

Solo Main Protection ruleset on `MrDemonWolf/community-bot` (planned; not yet applied):

- `main` requires status checks pass
- `main` requires PR (no direct push)
- `main` admin-bypassable (Nathanial can override for self-merge after cool-down)

## Disaster recovery RPO/RTO

- **RPO** (acceptable data loss): 24h (daily backup window)
- **RTO** (recovery time): 4h (Supabase restore + Dokploy redeploy)

If unacceptable: enable Supabase PITR (Point-in-Time Recovery) on a paid tier.

## Environment variables

All env vars validated at boot via Zod schemas in `apps/*/src/config.ts`. Missing/invalid → app refuses to start with a clear error.

`docs/env-vars.md` is the canonical list. Generated from `apps/server/src/config.ts` Zod schema.

## Logs viewing

- Local: `bun --filter=server dev` shows logs inline
- Dokploy: web dashboard → service → "Logs" tab (last 1000 lines + tail)
- Long-term: Logs are NOT archived. Audit log is the long-term record.

## Supabase local dev (Phase -1)

We use the Supabase CLI for local Postgres + Auth/Storage emulation. The `supabase/` directory at the repo root holds the project config.

### Prerequisites

- Docker Desktop running. On Apple Silicon prefer Docker Desktop 4.30+ or OrbStack; older Docker versions occasionally hang on pulling the `supabase/postgres` image.

### Day-to-day

```bash
bun supabase:start    # spin up containers (first run pulls images, ~5min)
bun supabase:status   # show URLs and keys
bun supabase:stop     # tear down
bun supabase:reset    # nuke and re-apply migrations (data loss)
```

`bun supabase:start` prints a local `DATABASE_URL` (port 54322 by default). Copy it into `apps/server/.env`.

### Apple Silicon troubleshooting

If `supabase:start` hangs on `Starting database...`:

1. `docker system prune --volumes`
2. `bunx supabase stop --no-backup` to clear residual containers
3. Restart Docker Desktop, retry

If the pull fails on a flaky network, run `docker pull supabase/postgres:15.8.1.060` manually then retry.
