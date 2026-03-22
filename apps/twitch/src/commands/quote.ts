import { TwitchCommand } from "../types/command.js";
import { db, eq, and, count, desc } from "@community-bot/db";
import { quotes } from "@community-bot/db";
import { getGame } from "../services/streamStatusManager.js";
import { getBotChannelId } from "../services/broadcasterCache.js";

async function getNextQuoteNumber(botChannelId: string): Promise<number> {
  const last = await db.query.quotes.findFirst({
    where: eq(quotes.botChannelId, botChannelId),
    orderBy: desc(quotes.quoteNumber),
    columns: { quoteNumber: true },
  });
  return (last?.quoteNumber ?? 0) + 1;
}

export const quote: TwitchCommand = {
  name: "quote",
  description: "View, add, or remove quotes.",
  async execute(client, channel, user, args, msg) {
    const botChannelId = getBotChannelId(channel);
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

      await db.insert(quotes).values({
        quoteNumber,
        text,
        game: currentGame,
        addedBy: user,
        source: "twitch",
        botChannelId,
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

      const deleted = await db
        .delete(quotes)
        .where(
          and(
            eq(quotes.quoteNumber, num),
            eq(quotes.botChannelId, botChannelId)
          )
        )
        .returning();
      if (deleted.length === 0) {
        await client.say(channel, `@${user}, quote #${num} not found.`);
      } else {
        await client.say(channel, `@${user}, quote #${num} removed.`);
      }
      return;
    }

    // !quote <number> — show specific quote
    const num = parseInt(sub, 10);
    if (!isNaN(num)) {
      const q = await db.query.quotes.findFirst({
        where: and(
          eq(quotes.quoteNumber, num),
          eq(quotes.botChannelId, botChannelId)
        ),
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
    const [{ value: quoteCount }] = await db
      .select({ value: count() })
      .from(quotes)
      .where(eq(quotes.botChannelId, botChannelId));
    if (quoteCount === 0) {
      await client.say(channel, `@${user}, no quotes yet. Add one with !quote add <text>`);
      return;
    }

    const skip = Math.floor(Math.random() * quoteCount);
    const [randomQuote] = await db.query.quotes.findMany({
      where: eq(quotes.botChannelId, botChannelId),
      offset: skip,
      limit: 1,
    });

    if (randomQuote) {
      const gamePart = randomQuote.game ? ` [${randomQuote.game}]` : "";
      await client.say(channel, `#${randomQuote.quoteNumber}: "${randomQuote.text}"${gamePart}`);
    }
  },
};
