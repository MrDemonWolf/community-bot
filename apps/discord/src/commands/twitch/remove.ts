import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { db, eq, and, discordGuilds, twitchChannels, twitchNotifications } from "@community-bot/db";
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
    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.guildId, guildId),
    });

    if (!guild) {
      await interaction.editReply({
        content: "This server is not registered in the database.",
      });
      return;
    }

    const channel = await db.query.twitchChannels.findFirst({
      where: and(eq(twitchChannels.username, username), eq(twitchChannels.guildId, guild.id)),
    });

    if (!channel) {
      await interaction.editReply({
        content: `**${username}** is not being monitored in this server.`,
      });
      return;
    }

    // Delete associated notifications first
    await db.delete(twitchNotifications).where(eq(twitchNotifications.twitchChannelId, channel.id));

    await db.delete(twitchChannels).where(eq(twitchChannels.id, channel.id));

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
