import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import { resolveBotChannelId } from "./resolve.js";
import logger from "../../utils/logger.js";

export async function handleQuoteSearch(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const botChannelId = await resolveBotChannelId(guildId);
    if (!botChannelId) {
      await interaction.editReply({
        content: "No linked Twitch channel found for this server.",
      });
      return;
    }

    const query = interaction.options.getString("text", true);

    const quotes = await prisma.quote.findMany({
      where: {
        botChannelId,
        text: { contains: query, mode: "insensitive" },
      },
      orderBy: { quoteNumber: "asc" },
      take: 10,
    });

    if (quotes.length === 0) {
      await interaction.editReply({
        content: `No quotes found matching "${query}".`,
      });
      return;
    }

    const lines = quotes.map((q) => `**#${q.quoteNumber}:** "${q.text}"`);
    await interaction.editReply({
      content: lines.join("\n"),
    });

    logger.commands.success(
      "quote search",
      interaction.user.username,
      interaction.user.id,
      guildId
    );
  } catch (err) {
    logger.commands.error(
      "quote search",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({ content: "An error occurred." });
  }
}
