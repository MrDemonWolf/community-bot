import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import { getTwitchUser } from "../../twitch/api.js";
import logger from "../../utils/logger.js";

export async function handleAdd(
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
    const twitchUser = await getTwitchUser(username);

    if (!twitchUser) {
      await interaction.editReply({
        content: `Twitch user **${username}** not found.`,
      });
      return;
    }

    // Find the guild record
    const guild = await prisma.discordGuild.findUnique({
      where: { guildId },
    });

    if (!guild) {
      await interaction.editReply({
        content: "This server is not registered in the database.",
      });
      return;
    }

    // Check if already monitoring
    const existing = await prisma.twitchChannel.findUnique({
      where: {
        twitchChannelId_guildId: {
          twitchChannelId: twitchUser.id,
          guildId: guild.id,
        },
      },
    });

    if (existing) {
      await interaction.editReply({
        content: `**${twitchUser.display_name}** is already being monitored in this server.`,
      });
      return;
    }

    await prisma.twitchChannel.create({
      data: {
        twitchChannelId: twitchUser.id,
        username: twitchUser.login,
        displayName: twitchUser.display_name,
        profileImageUrl: twitchUser.profile_image_url,
        guildId: guild.id,
      },
    });

    logger.commands.success(
      "twitch add",
      interaction.user.username,
      interaction.user.id,
      guildId
    );

    await interaction.editReply({
      content: `Now monitoring **${twitchUser.display_name}** for live streams.`,
    });
  } catch (err) {
    logger.commands.error(
      "twitch add",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while adding the Twitch channel.",
    });
  }
}
