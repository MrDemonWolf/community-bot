import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import type { TwitchChannel } from "@community-bot/db";
import logger from "../../utils/logger.js";

export async function handleList(
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

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = await prisma.discordGuild.findUnique({
      where: { guildId },
      include: { TwitchChannel: true },
    });

    if (!guild) {
      await interaction.editReply({
        content: "This server is not registered in the database.",
      });
      return;
    }

    const channels = guild.TwitchChannel;

    const embed = new EmbedBuilder()
      .setTitle("Twitch Stream Monitoring")
      .setColor(0x9146ff);

    // Config section
    const configLines: string[] = [];
    configLines.push(
      `**Notification Channel:** ${guild.notificationChannelId ? `<#${guild.notificationChannelId}>` : "Not set"}`
    );
    configLines.push(
      `**Notification Role:** ${guild.notificationRoleId ? `<@&${guild.notificationRoleId}>` : "Not set"}`
    );
    embed.setDescription(configLines.join("\n"));

    if (channels.length === 0) {
      embed.addFields({
        name: "Monitored Channels",
        value: "No channels are being monitored.",
      });
    } else {
      const channelList = channels
        .map((ch: TwitchChannel) => {
          const status = ch.isLive ? "🟢 Live" : "⚫ Offline";
          const name = ch.displayName ?? ch.username ?? ch.twitchChannelId;
          return `${status} **${name}**`;
        })
        .join("\n");

      embed.addFields({
        name: `Monitored Channels (${channels.length})`,
        value: channelList,
      });
    }

    logger.commands.success(
      "twitch list",
      interaction.user.username,
      interaction.user.id,
      guildId
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.commands.error(
      "twitch list",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while fetching the channel list.",
    });
  }
}
