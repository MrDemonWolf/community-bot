import { TwitchCommand } from "../types/command.js";
import { prisma } from "@community-bot/db";
import { getGame } from "../services/streamStatusManager.js";

function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}

async function getBotChannelId(channel: string): Promise<string | null> {
  const username = stripHash(channel).toLowerCase();
  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: username },
  });
  return botChannel?.id ?? null;
}

async function getNextQuoteNumber(botChannelId: string): Promise<number> {
  const last = await prisma.quote.findFirst({
    where: { botChannelId },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });
  return (last?.quoteNumber ?? 0) + 1;
}

export const quote: TwitchCommand = {
  name: "quote",
  description: "View, add, or remove quotes.",
  async execute(client, channel, user, args, msg) {
    const botChannelId = await getBotChannelId(channel);
    if (!botChannelId) {
      await client.say(channel, `@${user}, bot channel not configured.`);
      return;
    }

    const sub = args[0]?.toLowerCase();
    const isMod = msg.userInfo.isMod || msg.userInfo.isBroadcaster;

    // !quote add <text>
    if (sub === "add") {
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can add quotes.`);
        return;
      }
      const text = args.slice(1).join(" ");
      if (!text) {
        await client.say(channel, `@${user}, usage: !quote add <text>`);
        return;
      }

      const quoteNumber = await getNextQuoteNumber(botChannelId);
      const currentGame = getGame(channel) || null;

      await prisma.quote.create({
        data: {
          quoteNumber,
          text,
          game: currentGame,
          addedBy: user,
          source: "twitch",
          botChannelId,
        },
      });

      await client.say(channel, `@${user}, quote #${quoteNumber} added.`);
      return;
    }

    // !quote remove <number>
    if (sub === "remove" || sub === "delete") {
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can remove quotes.`);
        return;
      }
      const num = parseInt(args[1], 10);
      if (isNaN(num)) {
        await client.say(channel, `@${user}, usage: !quote remove <number>`);
        return;
      }

      try {
        await prisma.quote.delete({
          where: { quoteNumber_botChannelId: { quoteNumber: num, botChannelId } },
        });
        await client.say(channel, `@${user}, quote #${num} removed.`);
      } catch {
        await client.say(channel, `@${user}, quote #${num} not found.`);
      }
      return;
    }

    // !quote <number> — show specific quote
    const num = parseInt(sub, 10);
    if (!isNaN(num)) {
      const q = await prisma.quote.findUnique({
        where: { quoteNumber_botChannelId: { quoteNumber: num, botChannelId } },
      });
      if (!q) {
        await client.say(channel, `@${user}, quote #${num} not found.`);
        return;
      }
      const gamePart = q.game ? ` [${q.game}]` : "";
      await client.say(channel, `#${q.quoteNumber}: "${q.text}"${gamePart}`);
      return;
    }

    // !quote — random quote
    const count = await prisma.quote.count({ where: { botChannelId } });
    if (count === 0) {
      await client.say(channel, `@${user}, no quotes yet. Add one with !quote add <text>`);
      return;
    }

    const skip = Math.floor(Math.random() * count);
    const [randomQuote] = await prisma.quote.findMany({
      where: { botChannelId },
      skip,
      take: 1,
    });

    if (randomQuote) {
      const gamePart = randomQuote.game ? ` [${randomQuote.game}]` : "";
      await client.say(channel, `#${randomQuote.quoteNumber}: "${randomQuote.text}"${gamePart}`);
    }
  },
};
