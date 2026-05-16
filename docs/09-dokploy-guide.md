# 09 — Dokploy deployment guide

## What Dokploy is

Self-hosted Heroku-alike, open-source, free. Runs Docker Swarm with Traefik for auto-HTTPS. Dashboard for deploys, logs, env vars, DBs, backups.

## VPS requirements

- **OS:** Ubuntu 24.04 LTS (22.04 also fine)
- **Min specs:** 2 vCPU, 4 GB RAM, 40 GB SSD
- **Recommended:** 4 vCPU, 8 GB RAM, 80 GB SSD
- **Provider:** Hetzner (CX22 €4/mo to start), DigitalOcean, Vultr, OVH
- **Region:** EU for GDPR simplicity if you have EU viewers
- **DNS:** ability to add A records on your domain

## First-time VPS setup (once, ~15 min)

```bash
# As root:
apt update && apt upgrade -y
adduser howlbot
usermod -aG sudo howlbot
rsync --archive --chown=howlbot:howlbot ~/.ssh /home/howlbot
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
apt install -y fail2ban
# Swap (helps on 4GB boxes)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Disable root SSH after confirming `howlbot` user works. Keys only.

## Install Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Dokploy installs Docker + Swarm + its own Postgres + Redis + dashboard. When done:

```
Congratulations, Dokploy is installed!
Please go to http://YOUR-SERVER-IP:3000
```

## First-time Dokploy setup

1. Visit `http://YOUR-SERVER-IP:3000`
2. Create owner account; enable 2FA immediately
3. Settings → SMTP (use Mailgun or Resend for transactional emails)
4. Settings → Domain → set Dokploy dashboard to `dokploy.mrdemonwolf.com` with Let's Encrypt

## Two Dokploy projects

No staging (we keep it simple, single-streamer use case):

1. **`community-bot-infra`** — long-lived externals
   - Supabase (deploy via Dokploy's Supabase template)
2. **`community-bot`** — the app
   - `web`, `server`, `twitch`, `discord` services
   - Each pulls from `ghcr.io/mrdemonwolf/community-bot-<service>:latest`

(Note: we initially specced staging + prod, then decided that's overkill for a self-hosted single-streamer bot. If we ever want to add staging back, it's just a second `community-bot` project + a separate Supabase + separate domains.)

## DNS setup

Add A records pointing at the VPS IP:

- `bot.mrdemonwolf.com` → web
- `bot-api.mrdemonwolf.com` → server
- `bot-twitch.mrdemonwolf.com` → twitch (optional, for health endpoint)
- `bot-discord.mrdemonwolf.com` → discord (optional)
- `supabase.mrdemonwolf.com` → Supabase studio (use Dokploy's domain helper)
- `dokploy.mrdemonwolf.com` → Dokploy dashboard

## Supabase setup via Dokploy

1. New project → "Application" → "Docker Compose" → template "Supabase"
2. Set domain `supabase.mrdemonwolf.com`
3. Set strong `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` (Dokploy generates)
4. Enable: `pgmq`, `pg_cron`, `pgcrypto`, `vector` (last one optional for AI embeddings)
5. Verify Studio loads at the domain
6. Save the `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for the app

## Repo deploy via `docker/compose.yml`

```yaml
# docker/compose.yml
services:
  web:
    image: ghcr.io/mrdemonwolf/community-bot-web:latest
    restart: unless-stopped
    networks: [dokploy-network]
    labels:
      - traefik.enable=true
      - traefik.http.routers.cb-web.rule=Host(`bot.mrdemonwolf.com`)
      - traefik.http.routers.cb-web.entrypoints=websecure
      - traefik.http.routers.cb-web.tls.certResolver=letsencrypt
      - traefik.http.services.cb-web.loadbalancer.server.port=3000

  server:
    image: ghcr.io/mrdemonwolf/community-bot-server:latest
    restart: unless-stopped
    networks: [dokploy-network]
    labels:
      - traefik.enable=true
      - traefik.http.routers.cb-server.rule=Host(`bot-api.mrdemonwolf.com`)
      - traefik.http.routers.cb-server.entrypoints=websecure
      - traefik.http.routers.cb-server.tls.certResolver=letsencrypt
      - traefik.http.services.cb-server.loadbalancer.server.port=3001

  twitch:
    image: ghcr.io/mrdemonwolf/community-bot-twitch:latest
    restart: unless-stopped
    networks: [dokploy-network]
    stop_grace_period: 30s
    labels:
      - traefik.enable=true
      - traefik.http.routers.cb-twitch.rule=Host(`bot-twitch.mrdemonwolf.com`)
      - traefik.http.routers.cb-twitch.entrypoints=websecure
      - traefik.http.routers.cb-twitch.tls.certResolver=letsencrypt
      - traefik.http.services.cb-twitch.loadbalancer.server.port=3002

  discord:
    image: ghcr.io/mrdemonwolf/community-bot-discord:latest
    restart: unless-stopped
    networks: [dokploy-network]
    stop_grace_period: 30s
    labels:
      - traefik.enable=true
      - traefik.http.routers.cb-discord.rule=Host(`bot-discord.mrdemonwolf.com`)
      - traefik.http.routers.cb-discord.entrypoints=websecure
      - traefik.http.routers.cb-discord.tls.certResolver=letsencrypt
      - traefik.http.services.cb-discord.loadbalancer.server.port=3003

networks:
  dokploy-network:
    external: true
```

Rules Dokploy needs:

- No `container_name:` (breaks logs/metrics)
- No bind mounts (named volumes only)
- `dokploy-network` external on every service
- Traefik labels only on public-facing services
- Ports never published to host (`ports:` omitted)

## CI build via GitHub Actions

`.github/workflows/build.yml` (Phase -1 deliverable):

```yaml
name: Build & push images
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [web, server, twitch, discord]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ghcr.io/mrdemonwolf/community-bot-${{ matrix.app }}:latest
```

## Dokploy deploy webhook

In `community-bot` Dokploy project:

- Add deploy webhook for each service
- In GitHub repo settings → Webhooks → add Dokploy's URL with content type JSON, triggered on `package` events (so each GHCR push triggers redeploy)

## Backups

Dokploy supports scheduled Postgres backups to S3-compatible storage. Configure in Supabase project → Backups. Daily at 4am UTC, retain 7 daily + 4 weekly + 12 monthly.

## Smoke test after deploy

- `curl https://bot.mrdemonwolf.com/healthz` → 200 OK
- `curl https://bot-api.mrdemonwolf.com/healthz` → 200 OK
- `curl https://bot-twitch.mrdemonwolf.com/healthz` → 200 OK
- `curl https://bot-discord.mrdemonwolf.com/healthz` → 200 OK
- Visit `https://bot.mrdemonwolf.com` → login flow loads
- Discord bot shows online in your guild

## Rollback

Dokploy keeps last N image revisions. "Rollback" button in dashboard. For DB rollback: restore from latest backup before the bad deploy.
