import { createLogger } from "@community-bot/logging";
import { env } from "./env.js";

/**
 * Twitch bot logger - uses shared logging package with Twitch-specific methods
 */
export const logger = createLogger(
  "twitch",
  env.NODE_ENV,
  "Twitch - Command",
  (base) => ({
    authenticated: (username: string) =>
      base.ready("Twitch", `Successfully authenticated as ${username}`),
    authFailed: (attempt: number, reason: string) =>
      base.error(
        "Twitch",
        `Authentication failed (attempt ${attempt}): ${reason}`
      ),
    connected: () => base.ready("Twitch", "Connected to Twitch chat"),
    disconnected: (manually: boolean, reason?: string) =>
      base.warn(
        "Twitch",
        `Disconnected from Twitch chat (manual: ${manually}, reason: ${reason ?? "unknown"})`
      ),
    channelJoined: (channel: string, user: string) =>
      base.info("Twitch", `${user} joined ${channel}`),
    channelJoinFailed: (channel: string, reason: string) =>
      base.error("Twitch", `Failed to join ${channel}: ${reason}`),
    channelParted: (channel: string, user: string) =>
      base.info("Twitch", `${user} left ${channel}`),
    tokenRefreshed: (userId: string) =>
      base.info("Twitch Auth", `Token refreshed for user ${userId}`),
  })
);

export default logger;
