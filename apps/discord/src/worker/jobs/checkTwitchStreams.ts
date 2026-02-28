import type { Client, TextChannel, NewsChannel } from "discord.js";
import { ChannelType } from "discord.js";

import { prisma } from "@community-bot/db";
import { getStreams } from "../../twitch/api.js";
import {
  buildLiveEmbed,
  buildOfflineEmbed,
  buildCustomEmbed,
  type TemplateVariables,
  formatDuration,
} from "../../twitch/embeds.js";
import logger from "../../utils/logger.js";

/**
 * Resolve the notification channel ID for a given TwitchChannel,
 * falling back to the guild default.
 */
export function resolveNotificationChannelId(
  channel: { notificationChannelId: string | null },
  guild: { notificationChannelId: string | null }
): string | null {
  return channel.notificationChannelId ?? guild.notificationChannelId;
}

/**
 * Resolve the role mention string for a given TwitchChannel,
 * falling back to the guild default.
 */
export function resolveRoleMention(
  channel: { notificationRoleId: string | null },
  guild: { notificationRoleId: string | null }
): string {
  const roleId = channel.notificationRoleId ?? guild.notificationRoleId;
  if (!roleId) return "";
  return roleId === "everyone" ? "@everyone" : `<@&${roleId}>`;
}

export default async function checkTwitchStreams(client: Client): Promise<void> {
  try {
    // 1. Get all monitored channels with their guild config
    const channels = await prisma.twitchChannel.findMany({
      where: { guildId: { not: null } },
      include: {
        DiscordGuild: true,
        TwitchNotification: {
          where: { isLive: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (channels.length === 0) return;

    // 2. Deduplicate twitch channel IDs and batch-fetch streams
    const uniqueIds = [...new Set(channels.map((ch: { twitchChannelId: string }) => ch.twitchChannelId))] as string[];
    const streams = await getStreams(uniqueIds);
    const streamMap = new Map(streams.map((s) => [s.user_id, s]));

    // 3. Process each channel
    for (const channel of channels) {
      const guild = channel.DiscordGuild;
      if (!guild) continue;
      if (guild.enabled === false) continue;

      const notifChannelId = resolveNotificationChannelId(channel, guild);
      if (!notifChannelId) continue;

      const stream = streamMap.get(channel.twitchChannelId);
      const wasLive = channel.isLive;
      const isNowLive = !!stream;
      const activeNotification = channel.TwitchNotification[0];

      try {
        if (!wasLive && isNowLive && stream) {
          // --- Offline → Live ---
          await prisma.twitchChannel.update({
            where: { id: channel.id },
            data: {
              isLive: true,
              lastStreamTitle: stream.title,
              lastGameName: stream.game_name,
              lastStartedAt: new Date(stream.started_at),
            },
          });

          const discordChannel = (await client.channels.fetch(
            notifChannelId
          )) as TextChannel | NewsChannel | null;
          if (!discordChannel) continue;

          const startedAt = new Date(stream.started_at);
          const roleMention = resolveRoleMention(channel, guild);

          const templateVars: TemplateVariables = {
            streamer: channel.displayName ?? channel.username ?? "",
            title: stream.title,
            game: stream.game_name,
            viewers: stream.viewer_count.toLocaleString(),
            url: `https://www.twitch.tv/${channel.username ?? ""}`,
            thumbnail: stream.thumbnail_url,
            duration: formatDuration(Date.now() - startedAt.getTime()),
          };

          const embed =
            channel.useCustomMessage && channel.customOnlineMessage
              ? buildCustomEmbed(channel.customOnlineMessage, templateVars)
              : null;

          const finalEmbed =
            embed ??
            buildLiveEmbed({
              displayName: channel.displayName ?? channel.username ?? "",
              username: channel.username ?? "",
              profileImageUrl: channel.profileImageUrl ?? "",
              stream,
              startedAt,
            });

          const message = await discordChannel.send({
            content: roleMention || undefined,
            embeds: [finalEmbed],
          });

          // Auto-publish in announcement channels
          if (
            channel.autoPublish &&
            discordChannel.type === ChannelType.GuildAnnouncement
          ) {
            try {
              await message.crosspost();
            } catch {
              logger.debug(
                "Twitch Streams",
                `Could not crosspost notification for ${channel.displayName ?? channel.username}`
              );
            }
          }

          await prisma.twitchNotification.create({
            data: {
              messageId: message.id,
              channelId: notifChannelId,
              guildId: guild.guildId,
              twitchChannelId: channel.id,
              isLive: true,
              streamStartedAt: startedAt,
            },
          });

          logger.info(
            "Twitch Streams",
            `${channel.displayName ?? channel.username} went live in guild ${guild.guildId}`
          );
        } else if (wasLive && isNowLive && stream && activeNotification) {
          // --- Still Live (update embed) ---
          if (!channel.updateMessageLive) continue;

          await prisma.twitchChannel.update({
            where: { id: channel.id },
            data: {
              lastStreamTitle: stream.title,
              lastGameName: stream.game_name,
            },
          });

          try {
            const discordChannel = (await client.channels.fetch(
              activeNotification.channelId
            )) as TextChannel | NewsChannel | null;
            if (!discordChannel) continue;

            const message = await discordChannel.messages.fetch(
              activeNotification.messageId
            );

            const startedAt =
              activeNotification.streamStartedAt ?? new Date(stream.started_at);

            const templateVars: TemplateVariables = {
              streamer: channel.displayName ?? channel.username ?? "",
              title: stream.title,
              game: stream.game_name,
              viewers: stream.viewer_count.toLocaleString(),
              url: `https://www.twitch.tv/${channel.username ?? ""}`,
              thumbnail: stream.thumbnail_url,
              duration: formatDuration(Date.now() - startedAt.getTime()),
            };

            const embed =
              channel.useCustomMessage && channel.customOnlineMessage
                ? buildCustomEmbed(channel.customOnlineMessage, templateVars)
                : null;

            const finalEmbed =
              embed ??
              buildLiveEmbed({
                displayName: channel.displayName ?? channel.username ?? "",
                username: channel.username ?? "",
                profileImageUrl: channel.profileImageUrl ?? "",
                stream,
                startedAt,
              });

            const roleMention = resolveRoleMention(channel, guild);

            await message.edit({
              content: roleMention || undefined,
              embeds: [finalEmbed],
            });
          } catch {
            // Message may have been deleted — ignore
            logger.debug(
              "Twitch Streams",
              `Could not edit notification for ${channel.displayName ?? channel.username}`
            );
          }
        } else if (wasLive && !isNowLive) {
          // --- Live → Offline ---
          const offlineAt = new Date();

          await prisma.twitchChannel.update({
            where: { id: channel.id },
            data: { isLive: false },
          });

          if (activeNotification) {
            await prisma.twitchNotification.update({
              where: { id: activeNotification.id },
              data: { isLive: false },
            });

            try {
              const discordChannel = (await client.channels.fetch(
                activeNotification.channelId
              )) as TextChannel | NewsChannel | null;
              if (!discordChannel) continue;

              if (channel.deleteWhenOffline) {
                // Delete the notification message instead of editing to offline
                const message = await discordChannel.messages.fetch(
                  activeNotification.messageId
                );
                await message.delete();
              } else {
                const message = await discordChannel.messages.fetch(
                  activeNotification.messageId
                );

                const startedAt =
                  activeNotification.streamStartedAt ??
                  channel.lastStartedAt ??
                  offlineAt;

                const templateVars: TemplateVariables = {
                  streamer: channel.displayName ?? channel.username ?? "",
                  title: channel.lastStreamTitle ?? "Stream",
                  game: channel.lastGameName ?? "Unknown",
                  url: `https://www.twitch.tv/${channel.username ?? ""}`,
                  duration: formatDuration(offlineAt.getTime() - startedAt.getTime()),
                };

                const embed =
                  channel.useCustomMessage && channel.customOfflineMessage
                    ? buildCustomEmbed(channel.customOfflineMessage, templateVars)
                    : null;

                const finalEmbed =
                  embed ??
                  buildOfflineEmbed({
                    displayName: channel.displayName ?? channel.username ?? "",
                    username: channel.username ?? "",
                    profileImageUrl: channel.profileImageUrl ?? "",
                    title: channel.lastStreamTitle ?? "Stream",
                    gameName: channel.lastGameName ?? "Unknown",
                    startedAt,
                    offlineAt,
                  });

                const roleMention = resolveRoleMention(channel, guild);

                await message.edit({
                  content: roleMention || undefined,
                  embeds: [finalEmbed],
                });
              }
            } catch {
              logger.debug(
                "Twitch Streams",
                `Could not edit offline notification for ${channel.displayName ?? channel.username}`
              );
            }
          }

          logger.info(
            "Twitch Streams",
            `${channel.displayName ?? channel.username} went offline in guild ${guild.guildId}`
          );
        }
        // Still Offline → no action
      } catch (channelErr) {
        logger.error(
          "Twitch Streams",
          `Error processing channel ${channel.twitchChannelId}`,
          channelErr
        );
      }
    }
  } catch (err) {
    logger.error("Twitch Streams", "Error in checkTwitchStreams job", err);
  }
}
