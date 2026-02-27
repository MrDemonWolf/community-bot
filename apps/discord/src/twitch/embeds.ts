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

export interface TemplateVariables {
  streamer?: string;
  title?: string;
  game?: string;
  viewers?: string;
  url?: string;
  thumbnail?: string;
  duration?: string;
  [key: string]: string | undefined;
}

export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = variables[key];
    return value !== undefined ? value : match;
  });
}

interface CustomEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface CustomEmbedJson {
  author?: { name?: string; icon_url?: string; url?: string };
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: CustomEmbedField[];
  thumbnail?: { url?: string };
  image?: { url?: string };
  footer?: { text?: string; icon_url?: string };
  timestamp?: string;
}

export function buildCustomEmbed(
  customJson: string,
  variables: TemplateVariables
): EmbedBuilder | null {
  if (!customJson || customJson.trim() === "") return null;

  let parsed: CustomEmbedJson;
  try {
    parsed = JSON.parse(customJson) as CustomEmbedJson;
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const replace = (s: string | undefined) =>
    s ? replaceTemplateVariables(s, variables) : undefined;

  const embed = new EmbedBuilder();

  if (parsed.author?.name) {
    embed.setAuthor({
      name: replace(parsed.author.name)!,
      iconURL: replace(parsed.author.icon_url),
      url: replace(parsed.author.url),
    });
  }

  if (parsed.title) embed.setTitle(replace(parsed.title)!);
  if (parsed.url) embed.setURL(replace(parsed.url)!);
  if (parsed.description) embed.setDescription(replace(parsed.description)!);
  if (parsed.color !== undefined) embed.setColor(parsed.color);
  if (parsed.thumbnail?.url) embed.setThumbnail(replace(parsed.thumbnail.url)!);
  if (parsed.image?.url) embed.setImage(replace(parsed.image.url)!);

  if (parsed.footer?.text) {
    embed.setFooter({
      text: replace(parsed.footer.text)!,
      iconURL: replace(parsed.footer.icon_url),
    });
  }

  if (parsed.fields && Array.isArray(parsed.fields)) {
    embed.addFields(
      parsed.fields.map((f) => ({
        name: replace(f.name) ?? "",
        value: replace(f.value) ?? "",
        inline: f.inline ?? false,
      }))
    );
  }

  if (parsed.timestamp) embed.setTimestamp(new Date(parsed.timestamp));

  return embed;
}

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
