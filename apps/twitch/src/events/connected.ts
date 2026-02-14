import { ChatClient } from "@twurple/chat";
import consola from "consola";

import { prisma } from "@community-bot/db";
import { botStatus } from "../app.js";

export function registerConnectionEvents(chatClient: ChatClient, channels: string[]): void {
  chatClient.onAuthenticationSuccess(() => {
    botStatus.status = "online";

    consola.ready({
      message: "[Twitch Event - Connected] Successfully authenticated with Twitch",
      badge: true,
      timestamp: new Date(),
    });

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
          consola.info({
            message: `[Twitch Event - Connected] Synced channel ${channel} to database`,
            badge: true,
            timestamp: new Date(),
          });
        })
        .catch((err: unknown) => {
          consola.error({
            message: `[Twitch Event - Connected] Failed to sync channel ${channel}: ${err}`,
            badge: true,
            timestamp: new Date(),
          });
        });
    }
  });

  chatClient.onAuthenticationFailure((text, retryCount) => {
    botStatus.status = "offline";
    consola.error({
      message: `[Twitch Event - Auth] Authentication failed (attempt ${retryCount}): ${text}`,
      badge: true,
      timestamp: new Date(),
    });
  });

  chatClient.onConnect(() => {
    consola.ready({
      message: "[Twitch Event - Connected] Connected to Twitch chat",
      badge: true,
      timestamp: new Date(),
    });
  });

  chatClient.onDisconnect((manually, reason) => {
    botStatus.status = "offline";
    consola.warn({
      message: `[Twitch Event - Connected] Disconnected from Twitch chat (manual: ${manually}, reason: ${reason ?? "unknown"})`,
      badge: true,
      timestamp: new Date(),
    });
  });
}
