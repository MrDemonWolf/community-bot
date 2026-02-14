import { EventBus } from "@community-bot/events";
import { env } from "@community-bot/env/server";

const globalForEvents = globalThis as typeof globalThis & {
  eventBus?: EventBus;
};

export const eventBus =
  globalForEvents.eventBus ?? new EventBus(env.REDIS_URL);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.eventBus = eventBus;
}
