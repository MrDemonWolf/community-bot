import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import { resolveBotChannelId } from "./resolve.js";
import logger from "../../utils/logger.js";

export async function handleQuoteAdd(
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

  // Check permissions: ManageMessages or mod
  const member = interaction.member;
  const hasPerms =
    member &&
    "permissions" in member &&
    typeof member.permissions === "object" &&
    "has" in member.permissions &&
    member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!hasPerms) {
    await interaction.reply({
      content: "You need the Manage Messages permission to add quotes.",
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

    const text = interaction.options.getString("text", true);

    // Get next quote number
    const last = await prisma.quote.findFirst({
      where: { botChannelId },
      orderBy: { quoteNumber: "desc" },
      select: { quoteNumber: true },
    });
    const quoteNumber = (last?.quoteNumber ?? 0) + 1;

    await prisma.quote.create({
      data: {
        quoteNumber,
        text,
        addedBy: interaction.user.username,
        source: "discord",
        botChannelId,
      },
    });

    logger.commands.success(
      "quote add",
      interaction.user.username,
      interaction.user.id,
      guildId
    );

    await interaction.editReply({
      content: `Quote #${quoteNumber} added: "${text}"`,
    });
  } catch (err) {
    logger.commands.error(
      "quote add",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({ content: "An error occurred." });
  }
}
