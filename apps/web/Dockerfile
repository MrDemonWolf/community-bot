FROM node:24-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache openssl
RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY packages/env/package.json packages/env/
COPY packages/events/package.json packages/events/
COPY packages/server/package.json packages/server/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build

ENV SKIP_ENV_VALIDATION=1

COPY --from=deps /usr/src/app/ ./

COPY packages/db ./packages/db
COPY packages/config ./packages/config
COPY packages/env ./packages/env
COPY packages/events ./packages/events
COPY packages/server ./packages/server
COPY packages/api ./packages/api
COPY packages/auth ./packages/auth
COPY apps/web ./apps/web
COPY turbo.json tsconfig.json ./

RUN pnpm --filter @community-bot/db db:generate
RUN --mount=type=cache,target=/usr/src/app/apps/web/.next/cache \
    pnpm --filter web build

FROM node:24-alpine AS production

WORKDIR /usr/src/app

RUN apk add --no-cache openssl curl
RUN npm install -g prisma

COPY --from=build /usr/src/app/apps/web/.next/standalone ./
COPY --from=build /usr/src/app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /usr/src/app/packages/db/prisma ./packages/db/prisma
RUN rm -rf packages/db/node_modules
COPY apps/web/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
