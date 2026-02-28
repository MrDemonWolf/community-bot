import { EmbedBuilder } from "discord.js";

import { getStreamThumbnailUrl } from "./api.js";
import type { TwitchStream } from "./api.js";
import env from "../utils/env.js";

const TWITCH_PURPLE = 0x9146ff;
const isDev = env.NODE_ENV === "development";

interface LiveEmbedOptions {
  displayName: string;
  username: string;
  profileImageUrl: string;
  stream: TwitchStream;
  startedAt: Date;
}

interface OfflineEmbedOptions {
  displayName: string;
  username: string;
  profileImageUrl: string;
  title: string;
  gameName: string;
  startedAt: Date;
  offlineAt: Date;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function buildLiveEmbed(options: LiveEmbedOptions): EmbedBuilder {
  const { displayName, username, profileImageUrl, stream, startedAt } = options;
  const twitchUrl = `https://www.twitch.tv/${username}`;
  const duration = formatDuration(Date.now() - startedAt.getTime());

  // Cache-bust the thumbnail so Discord refreshes it
  const thumbnailUrl =
    getStreamThumbnailUrl(stream.thumbnail_url) +
    `?t=${Date.now()}`;

  return new EmbedBuilder()
    .setAuthor({
      name: `${displayName} is live on Twitch`,
      iconURL: profileImageUrl,
      url: twitchUrl,
    })
    .setTitle(stream.title)
    .setURL(twitchUrl)
    .setColor(TWITCH_PURPLE)
    .addFields(
      { name: "Game", value: stream.game_name || "Unknown", inline: true },
      {
        name: "Viewers",
        value: stream.viewer_count.toLocaleString(),
        inline: true,
      }
    )
    .setImage(thumbnailUrl)
    .setFooter({
      text: isDev
        ? `Development Environment | Online for ${duration} | Last updated`
        : `Online for ${duration} | Last updated`,
    })
    .setTimestamp();
}

export { replaceTemplateVariables, buildCustomEmbed } from "../utils/embeds.js";
export type { TemplateVariables } from "../utils/embeds.js";

export function buildOfflineEmbed(options: OfflineEmbedOptions): EmbedBuilder {
  const {
    displayName,
    username,
    profileImageUrl,
    title,
    gameName,
    startedAt,
    offlineAt,
  } = options;
  const twitchUrl = `https://www.twitch.tv/${username}`;
  const duration = formatDuration(offlineAt.getTime() - startedAt.getTime());

  return new EmbedBuilder()
    .setAuthor({
      name: `${displayName} was live on Twitch`,
      iconURL: profileImageUrl,
      url: twitchUrl,
    })
    .setTitle(title)
    .setURL(twitchUrl)
    .setColor(TWITCH_PURPLE)
    .addFields({ name: "Game", value: gameName || "Unknown", inline: true })
    .setFooter({
      text: isDev
        ? `Development Environment | Online for ${duration} | Offline at`
        : `Online for ${duration} | Offline at`,
    })
    .setTimestamp(offlineAt);
}
