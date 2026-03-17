FROM oven/bun:1-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache openssl git

FROM base AS deps

COPY package.json bun.lock ./
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY packages/env/package.json packages/env/
COPY packages/events/package.json packages/events/
COPY packages/server/package.json packages/server/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY apps/discord/package.json apps/discord/
COPY apps/twitch/package.json apps/twitch/
COPY apps/web/package.json apps/web/
COPY apps/docs/package.json apps/docs/

RUN bun install --frozen-lockfile --ignore-scripts

FROM base AS production

WORKDIR /usr/src/app

RUN apk add --no-cache curl

COPY --from=deps /usr/src/app/ ./

COPY packages/db ./packages/db
COPY packages/config ./packages/config
COPY packages/env ./packages/env
COPY packages/events ./packages/events
COPY packages/server ./packages/server
COPY apps/discord ./apps/discord
COPY turbo.json tsconfig.json ./

COPY apps/discord/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3141

ENTRYPOINT ["./entrypoint.sh"]
CMD ["bun", "apps/discord/src/app.ts"]
