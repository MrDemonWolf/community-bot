import { createLogger } from "@community-bot/logging";
import env from "./env.js";

/**
 * Discord bot logger - uses shared logging package with Discord-specific methods
 */
export const logger = createLogger(
  "discord",
  env.NODE_ENV,
  "Discord - Command",
  (base) => ({
    shardLaunched: (shardId: number) =>
      base.success(
        "Discord - Event (Shard Launched)",
        `Shard ${shardId} launched`
      ),
    shardError: (shardId: number, error: Error | string | unknown) =>
      base.error(
        "Discord - Event (Shard Error)",
        `Shard ${shardId} error`,
        error
      ),
    ready: (username: string, guildCount: number) =>
      base.ready(
        "Discord - Event (Ready)",
        `Bot ready as ${username} in ${guildCount} guilds`,
        {
          botUsername: username,
          guildCount,
          timestamp: new Date().toISOString(),
        }
      ),
    guildJoined: (guildName: string, guildId: string, memberCount: number) =>
      base.info("Discord", `Joined guild: ${guildName}`, {
        guildId,
        guildName,
        memberCount,
        action: "guild_joined",
        timestamp: new Date().toISOString(),
      }),
    guildLeft: (guildName: string, guildId: string) =>
      base.info(
        "Discord - Event (Guild Left)",
        `Left guild: ${guildName}`,
        {
          guildId,
          guildName,
          action: "guild_left",
          timestamp: new Date().toISOString(),
        }
      ),
  }),
  {
    commands: {
      unauthorized: (
        command: string,
        username: string,
        id: string,
        guildId?: string
      ) => {
        logger.warn("Discord - Command", `Unauthorized access to ${command}`, {
          command,
          user: { username, id },
          ...(guildId && { guild: guildId }),
        });
      },
    },
    api: {
      request: (method: string, path: string, status: number) => {
        const isDev = env.NODE_ENV === "development";
        const logMethod = isDev ? logger.debug : logger.info;
        logMethod("API", `${method} ${path} - ${status}`, {
          method,
          path,
          status,
          timestamp: new Date().toISOString(),
        });
      },
    },
    unauthorized: (
      operation: string,
      username: string,
      userId: string,
      guildId?: string
    ) => {
      logger.warn("Security", `Unauthorized ${operation} attempt`, {
        user: { username, id: userId },
        ...(guildId && { guild: guildId }),
      });
    },
  }
);

export default logger;
