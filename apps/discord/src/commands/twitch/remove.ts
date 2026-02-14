import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";

export async function handleRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.options
    .getString("username", true)
    .toLowerCase()
    .trim();
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = await prisma.discordGuild.findUnique({
      where: { guildId },
    });

    if (!guild) {
      await interaction.editReply({
        content: "This server is not registered in the database.",
      });
      return;
    }

    const channel = await prisma.twitchChannel.findFirst({
      where: {
        username,
        guildId: guild.id,
      },
    });

    if (!channel) {
      await interaction.editReply({
        content: `**${username}** is not being monitored in this server.`,
      });
      return;
    }

    // Delete associated notifications first
    await prisma.twitchNotification.deleteMany({
      where: { twitchChannelId: channel.id },
    });

    await prisma.twitchChannel.delete({
      where: { id: channel.id },
    });

    logger.commands.success(
      "twitch remove",
      interaction.user.username,
      interaction.user.id,
      guildId
    );

    await interaction.editReply({
      content: `Stopped monitoring **${channel.displayName ?? username}**.`,
    });
  } catch (err) {
    logger.commands.error(
      "twitch remove",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while removing the Twitch channel.",
    });
  }
}
