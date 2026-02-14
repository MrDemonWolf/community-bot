import { ChannelType, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";

export async function handleSetChannel(
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

  const channel = interaction.options.getChannel("channel", true);

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "Please select a text channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await prisma.discordGuild.update({
      where: { guildId },
      data: { notificationChannelId: channel.id },
    });

    logger.commands.success(
      "twitch notifications set-channel",
      interaction.user.username,
      interaction.user.id,
      guildId
    );

    await interaction.editReply({
      content: `Twitch notifications will be sent to <#${channel.id}>.`,
    });
  } catch (err) {
    logger.commands.error(
      "twitch notifications set-channel",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while setting the notification channel.",
    });
  }
}
