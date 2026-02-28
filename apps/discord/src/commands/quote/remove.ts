import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import { resolveBotChannelId } from "./resolve.js";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";

export async function handleQuoteRemove(
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

  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content: "You need the Mod role or Manage Messages permission to remove quotes.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const botChannelId = await resolveBotChannelId(guildId);
    if (!botChannelId) {
      await interaction.editReply({
        content: "No linked Twitch channel found for this server.",
      });
      return;
    }

    const number = interaction.options.getInteger("number", true);

    try {
      await prisma.quote.delete({
        where: {
          quoteNumber_botChannelId: {
            quoteNumber: number,
            botChannelId,
          },
        },
      });

      logger.commands.success(
        "quote remove",
        interaction.user.username,
        interaction.user.id,
        guildId
      );

      await interaction.editReply({
        content: `Quote #${number} removed.`,
      });
    } catch {
      await interaction.editReply({
        content: `Quote #${number} not found.`,
      });
    }
  } catch (err) {
    logger.commands.error(
      "quote remove",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({ content: "An error occurred." });
  }
}
