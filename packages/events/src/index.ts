/**
 * @community-bot/events — Type-safe Redis Pub/Sub event bus.
 *
 * Provides real-time inter-service communication between the web dashboard,
 * Discord bot, and Twitch bot. All event types are defined in `./types.ts`
 * and enforced at compile time.
 */
export { EventBus } from "./bus";
export type { EventMap, EventName } from "./types";
