import type { TwitchCommand } from "../types/command.js";
import { getUserAccessLevel, meetsAccessLevel } from "../services/accessControl.js";
import { TwitchAccessLevel } from "@community-bot/db";
import {
  startGiveaway,
  drawWinner,
  endGiveaway,
  getEntryCount,
  getActiveGiveaway,
} from "../services/giveawayManager.js";
import { getBotChannelId } from "../services/broadcasterCache.js";
import { EventBus } from "@community-bot/events";

let eventBus: EventBus | null = null;

function getEventBus(): EventBus | null {
  if (!eventBus) {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) eventBus = new EventBus(redisUrl);
    } catch {
      // Silently ignore if EventBus not available
    }
  }
  return eventBus;
}

export const giveaway: TwitchCommand = {
  name: "giveaway",
  description: "Manage giveaways. Usage: !giveaway start <keyword> [title] | draw | reroll | end | count",
  async execute(chatClient, channel, user, args, msg) {
    const userLevel = getUserAccessLevel(msg);
    const subCommand = args[0]?.toLowerCase();
    const botChannelId = getBotChannelId(channel);

    if (!botChannelId) {
      chatClient.say(channel, `@${user}, Bot channel not found.`);
      return;
    }

    if (subCommand === "start") {
      if (!meetsAccessLevel(userLevel, TwitchAccessLevel.MODERATOR)) return;

      const keyword = args[1]?.toLowerCase();
      if (!keyword) {
        chatClient.say(channel, `@${user}, Usage: !giveaway start <keyword> [title]`);
        return;
      }

      const title = args.slice(2).join(" ") || `Giveaway (${keyword})`;
      const ga = await startGiveaway(botChannelId, keyword, title);

      const bus = getEventBus();
      if (bus) {
        await bus.publish("giveaway:started", { giveawayId: ga.id, channelId: channel });
      }

      chatClient.say(channel, `Giveaway started! Type "${keyword}" to enter. ${title}`);
    } else if (subCommand === "draw") {
      if (!meetsAccessLevel(userLevel, TwitchAccessLevel.MODERATOR)) return;

      const winner = await drawWinner(botChannelId);
      if (!winner) {
        chatClient.say(channel, `@${user}, No entries in the giveaway or no active giveaway.`);
        return;
      }

      const ga = await getActiveGiveaway(botChannelId);
      const bus = getEventBus();
      if (bus && ga) {
        await bus.publish("giveaway:winner", { giveawayId: ga.id, channelId: channel });
      }

      chatClient.say(channel, `The winner is @${winner}! Congratulations!`);
    } else if (subCommand === "reroll") {
      if (!meetsAccessLevel(userLevel, TwitchAccessLevel.MODERATOR)) return;

      const winner = await drawWinner(botChannelId);
      if (!winner) {
        chatClient.say(channel, `@${user}, No entries to reroll.`);
        return;
      }

      chatClient.say(channel, `Rerolled! New winner is @${winner}! Congratulations!`);
    } else if (subCommand === "end") {
      if (!meetsAccessLevel(userLevel, TwitchAccessLevel.MODERATOR)) return;

      const ga = await getActiveGiveaway(botChannelId);
      await endGiveaway(botChannelId);

      const bus = getEventBus();
      if (bus && ga) {
        await bus.publish("giveaway:ended", { giveawayId: ga.id, channelId: channel });
      }

      chatClient.say(channel, `Giveaway ended.`);
    } else if (subCommand === "count") {
      const count = await getEntryCount(botChannelId);
      chatClient.say(channel, `There are ${count} entries in the current giveaway.`);
    } else {
      chatClient.say(channel, `@${user}, Usage: !giveaway start|draw|reroll|end|count`);
    }
  },
};
