FROM oven/bun:1.4.3-alpine AS manifests
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/discord/package.json apps/discord/package.json
COPY apps/twitch/package.json apps/twitch/package.json
COPY apps/docs/package.json apps/docs/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/twitch/package.json packages/twitch/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/ui/package.json packages/ui/package.json

FROM manifests AS installed
RUN bun install --frozen-lockfile

FROM installed AS dependencies
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

FROM dependencies AS migrate
CMD ["bun", "run", "db:migrate"]

FROM node:22-alpine AS web-source
WORKDIR /app
COPY --from=installed /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

FROM web-source AS dev-web
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=$SOURCE_COMMIT
COPY --from=manifests /usr/local/bin/bun /usr/local/bin/bun
ENV NODE_ENV=development
EXPOSE 3001
WORKDIR /app/apps/web
CMD ["node", "node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "0.0.0.0", "--port", "3001"]

FROM web-source AS web-build
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=$SOURCE_COMMIT
WORKDIR /app/apps/web
# Build fixtures are public placeholders, never deployment credentials.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET=build-only-placeholder-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3001 OWNER_EMAIL=build@example.invalid \
    APP_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    node node_modules/next/dist/bin/next build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]

FROM dependencies AS discord-build
RUN bun run --cwd apps/discord build

FROM manifests AS discord-dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts --linker hoisted --filter discord

FROM oven/bun:1.4.3-alpine AS discord
WORKDIR /app/apps/discord
COPY --from=discord-dependencies --chown=bun:bun /app/node_modules /app/node_modules
COPY --from=discord-build --chown=bun:bun /app/apps/discord/dist ./dist
ENV NODE_ENV=production PORT=3003
USER bun
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD ["bun", "-e", "const r=await fetch('http://127.0.0.1:3003/healthz',{signal:AbortSignal.timeout(4000)});process.exit(r.ok?0:1)"]
CMD ["bun", "run", "dist/index.mjs"]

FROM mcr.microsoft.com/playwright:v1.64.1-noble AS e2e
WORKDIR /app
# The browser runner needs only Playwright, not the application dependency tree.
COPY --from=installed /app/node_modules/.bun/@playwright+test@1.64.1/node_modules/@playwright/test ./node_modules/@playwright/test
COPY --from=installed /app/node_modules/.bun/playwright@1.64.1/node_modules/playwright ./node_modules/playwright
COPY --from=installed /app/node_modules/.bun/playwright-core@1.64.1/node_modules/playwright-core ./node_modules/playwright-core
COPY package.json ./
COPY tests/e2e ./tests/e2e
ENV CI=true
CMD ["node", "node_modules/@playwright/test/cli.js", "test", "--config=tests/e2e/playwright.config.ts"]

FROM dependencies AS twitch-build
RUN bun run --cwd apps/twitch build

FROM manifests AS twitch-dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts --linker hoisted --filter twitch

FROM oven/bun:1.4.3-alpine AS twitch
WORKDIR /app/apps/twitch
COPY --from=twitch-dependencies --chown=bun:bun /app/node_modules /app/node_modules
COPY --from=twitch-build --chown=bun:bun /app/apps/twitch/dist ./dist
ENV NODE_ENV=production PORT=3003
USER bun
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD ["bun", "-e", "const r=await fetch('http://127.0.0.1:3003/health',{signal:AbortSignal.timeout(4000)});process.exit(r.ok?0:1)"]
CMD ["bun", "run", "dist/index.mjs"]
