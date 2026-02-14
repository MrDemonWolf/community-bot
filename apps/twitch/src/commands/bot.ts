import { prisma } from "@community-bot/db";
import { TwitchCommand } from "../types/command.js";
import { setMuted } from "../services/botState.js";
import { getEventBus } from "../services/eventBusAccessor.js";
import { logger } from "../utils/logger.js";

export const bot: TwitchCommand = {
  name: "bot",
  description: "Bot management commands (broadcaster only).",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isBroadcaster) return;

    const sub = args[0]?.toLowerCase();
    const channelName = channel.replace(/^#/, "").toLowerCase();

    if (sub === "mute") {
      setMuted(channel, true);

      // Persist to DB
      try {
        await prisma.botChannel.updateMany({
          where: { twitchUsername: channelName },
          data: { muted: true },
        });

        const eventBus = getEventBus();
        const botChannel = await prisma.botChannel.findFirst({
          where: { twitchUsername: channelName },
        });
        if (botChannel) {
          await eventBus.publish("bot:mute", {
            channelId: botChannel.twitchUserId,
            username: channelName,
            muted: true,
          });
        }
      } catch (err) {
        logger.warn("BotCmd", "Failed to persist mute state", err instanceof Error ? { error: err.message } : undefined);
      }

      await client.say(channel, `@${user}, I have been muted.`);
    } else if (sub === "unmute") {
      setMuted(channel, false);

      // Persist to DB
      try {
        await prisma.botChannel.updateMany({
          where: { twitchUsername: channelName },
          data: { muted: false },
        });

        const eventBus = getEventBus();
        const botChannel = await prisma.botChannel.findFirst({
          where: { twitchUsername: channelName },
        });
        if (botChannel) {
          await eventBus.publish("bot:mute", {
            channelId: botChannel.twitchUserId,
            username: channelName,
            muted: false,
          });
        }
      } catch (err) {
        logger.warn("BotCmd", "Failed to persist unmute state", err instanceof Error ? { error: err.message } : undefined);
      }

      await client.say(channel, `@${user}, I have been unmuted.`);
    }
  },
};
