import { ChatClient } from "@twurple/chat";

import { prisma } from "@community-bot/db";
import { botStatus } from "../app.js";
import { logger } from "../utils/logger.js";

export function registerConnectionEvents(chatClient: ChatClient, channels: string[]): void {
  chatClient.onAuthenticationSuccess(() => {
    botStatus.status = "online";

    logger.twitch.authenticated("Twitch");

    // Sync joined channels to the database
    for (const channel of channels) {
      prisma.twitchChannel
        .findFirst({
          where: { twitchChannelId: channel, guildId: null },
        })
        .then(async (existing) => {
          if (!existing) {
            await prisma.twitchChannel.create({
              data: { twitchChannelId: channel },
            });
          }
          logger.info("Twitch", `Synced channel ${channel} to database`);
        })
        .catch((err: unknown) => {
          logger.error("Twitch", `Failed to sync channel ${channel}`, err);
        });
    }
  });

  chatClient.onAuthenticationFailure((text, retryCount) => {
    botStatus.status = "offline";
    logger.twitch.authFailed(retryCount, text);
  });

  chatClient.onConnect(() => {
    logger.twitch.connected();
  });

  chatClient.onDisconnect((manually, reason) => {
    botStatus.status = "offline";
    logger.twitch.disconnected(manually, reason?.toString());
  });
}
