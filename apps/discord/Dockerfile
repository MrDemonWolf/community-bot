FROM oven/bun:1.3.14-alpine AS manifests
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/discord/package.json apps/discord/package.json
COPY apps/twitch/package.json apps/twitch/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/ui/package.json packages/ui/package.json

FROM manifests AS build
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter discord
COPY packages/config packages/config
COPY apps/discord/src apps/discord/src
COPY apps/discord/tsconfig.json apps/discord/tsdown.config.ts apps/discord/
RUN bun run --cwd apps/discord build

FROM manifests AS production-dependencies
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --production --filter discord

FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /app/apps/discord
ENV NODE_ENV=production PORT=3003
COPY --from=production-dependencies --chown=bun:bun /app/node_modules /app/node_modules
COPY --from=build --chown=bun:bun /app/apps/discord/dist ./dist
USER bun
EXPOSE 3003
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:' + (process.env.PORT ?? '3003') + '/readyz', {signal: AbortSignal.timeout(4000)}); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "run", "dist/index.mjs"]
