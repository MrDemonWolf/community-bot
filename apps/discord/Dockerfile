FROM node:23-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache openssl
RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY apps/discord/package.json apps/discord/

RUN pnpm install --frozen-lockfile

FROM base AS build

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /usr/src/app/apps/discord/node_modules ./apps/discord/node_modules

COPY packages/db ./packages/db
COPY packages/config ./packages/config
COPY apps/discord ./apps/discord
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

RUN pnpm --filter @community-bot/db db:generate
RUN pnpm --filter @community-bot/discord build

FROM node:23-alpine AS production

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY --from=build /usr/src/app/apps/discord/dist ./apps/discord/dist
COPY --from=build /usr/src/app/apps/discord/node_modules ./apps/discord/node_modules
COPY --from=build /usr/src/app/apps/discord/package.json ./apps/discord/
COPY --from=build /usr/src/app/packages/db ./packages/db
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "apps/discord/dist/app.js"]
