import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction, TextChannel } from "discord.js";

import { prisma } from "@community-bot/db";
import { buildLiveEmbed, buildOfflineEmbed } from "../../twitch/embeds.js";
import env from "../../utils/env.js";
import logger from "../../utils/logger.js";

import type { TwitchStream } from "../../twitch/api.js";

export async function handleTest(
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

  // Owner-only check
  if (interaction.user.id !== env.OWNER_ID) {
    logger.commands.unauthorized(
      "twitch test",
      interaction.user.username,
      interaction.user.id,
      guildId
    );
    await interaction.reply({
      content: "This command is restricted to the bot owner.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const username = interaction.options
    .getString("username", true)
    .toLowerCase()
    .trim();

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

    if (!guild.notificationChannelId) {
      await interaction.editReply({
        content:
          "No notification channel set. Use `/twitch notifications set-channel` first.",
      });
      return;
    }

    const channel = await prisma.twitchChannel.findFirst({
      where: { username, guildId: guild.id },
    });

    if (!channel) {
      await interaction.editReply({
        content: `**${username}** is not being monitored in this server. Add it first with \`/twitch add\`.`,
      });
      return;
    }

    const discordChannel = (await interaction.client.channels.fetch(
      guild.notificationChannelId
    )) as TextChannel | null;

    if (!discordChannel) {
      await interaction.editReply({
        content: "Could not find the notification channel.",
      });
      return;
    }

    const now = new Date();
    const fakeStream: TwitchStream = {
      id: "test-stream",
      user_id: channel.twitchChannelId,
      user_login: channel.username ?? username,
      user_name: channel.displayName ?? username,
      game_name: "Just Chatting",
      title: "Test Stream - This is a test notification!",
      viewer_count: 1234,
      started_at: now.toISOString(),
      thumbnail_url:
        "https://static-cdn.jtvnw.net/previews-ttv/live_user_{width}x{height}.jpg",
      type: "live",
    };

    const roleMention = guild.notificationRoleId
      ? `<@&${guild.notificationRoleId}>`
      : "";

    const liveEmbed = buildLiveEmbed({
      displayName: channel.displayName ?? username,
      username: channel.username ?? username,
      profileImageUrl: channel.profileImageUrl ?? "",
      stream: fakeStream,
      startedAt: now,
    });

    const message = await discordChannel.send({
      content: roleMention || undefined,
      embeds: [liveEmbed],
    });

    await interaction.editReply({
      content: `Test notification sent! It will be edited to offline in ~10 seconds.`,
    });

    // Auto-edit to offline after 10 seconds
    setTimeout(async () => {
      try {
        const offlineAt = new Date();
        const offlineEmbed = buildOfflineEmbed({
          displayName: channel.displayName ?? username,
          username: channel.username ?? username,
          profileImageUrl: channel.profileImageUrl ?? "",
          title: fakeStream.title,
          gameName: fakeStream.game_name,
          startedAt: now,
          offlineAt,
        });

        await message.edit({
          content: roleMention || undefined,
          embeds: [offlineEmbed],
        });
      } catch (editErr) {
        logger.error(
          "Twitch Test",
          "Failed to edit test notification to offline",
          editErr
        );
      }
    }, 10000);

    logger.commands.success(
      "twitch test",
      interaction.user.username,
      interaction.user.id,
      guildId
    );
  } catch (err) {
    logger.commands.error(
      "twitch test",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while sending the test notification.",
    });
  }
}
