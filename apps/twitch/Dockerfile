FROM node:24-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache openssl
RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY packages/env/package.json packages/env/
COPY packages/server/package.json packages/server/
COPY apps/twitch/package.json apps/twitch/

RUN pnpm install --frozen-lockfile

FROM base AS build

COPY --from=deps /usr/src/app/ ./

COPY packages/db ./packages/db
COPY packages/config ./packages/config
COPY packages/env ./packages/env
COPY packages/server ./packages/server
COPY apps/twitch ./apps/twitch
COPY turbo.json tsconfig.json ./

RUN pnpm --filter @community-bot/db db:generate
RUN pnpm --filter twitch-bot build

FROM node:24-alpine AS production

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY --from=build /usr/src/app/apps/twitch/dist ./apps/twitch/dist
COPY --from=build /usr/src/app/apps/twitch/node_modules ./apps/twitch/node_modules
COPY --from=build /usr/src/app/apps/twitch/package.json ./apps/twitch/
COPY --from=build /usr/src/app/packages/db ./packages/db
COPY --from=build /usr/src/app/packages/env ./packages/env
COPY --from=build /usr/src/app/packages/server ./packages/server
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./

ENV NODE_ENV=production

EXPOSE 3737

CMD ["node", "apps/twitch/dist/app.js"]
