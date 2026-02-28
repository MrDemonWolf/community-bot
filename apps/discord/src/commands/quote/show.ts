import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import { resolveBotChannelId } from "./resolve.js";
import logger from "../../utils/logger.js";

export async function handleQuoteShow(
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

    const number = interaction.options.getInteger("number");

    if (number !== null) {
      // Show specific quote
      const quote = await prisma.quote.findUnique({
        where: {
          quoteNumber_botChannelId: {
            quoteNumber: number,
            botChannelId,
          },
        },
      });

      if (!quote) {
        await interaction.editReply({ content: `Quote #${number} not found.` });
        return;
      }

      const gamePart = quote.game ? ` [${quote.game}]` : "";
      await interaction.editReply({
        content: `**#${quote.quoteNumber}:** "${quote.text}"${gamePart}`,
      });
      return;
    }

    // Random quote
    const count = await prisma.quote.count({ where: { botChannelId } });
    if (count === 0) {
      await interaction.editReply({ content: "No quotes yet." });
      return;
    }

    const skip = Math.floor(Math.random() * count);
    const [quote] = await prisma.quote.findMany({
      where: { botChannelId },
      skip,
      take: 1,
    });

    if (quote) {
      const gamePart = quote.game ? ` [${quote.game}]` : "";
      await interaction.editReply({
        content: `**#${quote.quoteNumber}:** "${quote.text}"${gamePart}`,
      });
    }

    logger.commands.success(
      "quote show",
      interaction.user.username,
      interaction.user.id,
      guildId
    );
  } catch (err) {
    logger.commands.error(
      "quote show",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({ content: "An error occurred." });
  }
}
