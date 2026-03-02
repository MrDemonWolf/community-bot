import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "@community-bot/db";
import logger from "./logger.js";

type LogCategory = "moderation" | "server" | "voice";

interface LogConfigCache {
  moderationChannelId: string | null;
  serverChannelId: string | null;
  voiceChannelId: string | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const logConfigCache = new Map<string, LogConfigCache>();

async function getLogConfig(guildId: string): Promise<LogConfigCache> {
  const cached = logConfigCache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const config = await prisma.discordLogConfig.findUnique({
    where: { guildId },
  });

  const entry: LogConfigCache = {
    moderationChannelId: config?.moderationChannelId ?? null,
    serverChannelId: config?.serverChannelId ?? null,
    voiceChannelId: config?.voiceChannelId ?? null,
    fetchedAt: Date.now(),
  };

  logConfigCache.set(guildId, entry);
  return entry;
}

export function clearLogConfigCache(guildId: string): void {
  logConfigCache.delete(guildId);
}

/**
 * Dispatch a log embed to the appropriate log channel for a guild.
 * Silently no-ops if no log channel is configured for the category.
 */
export async function dispatchLog(
  client: Client,
  guildId: string,
  category: LogCategory,
  embed: EmbedBuilder
): Promise<void> {
  try {
    const config = await getLogConfig(guildId);

    const channelIdMap: Record<LogCategory, string | null> = {
      moderation: config.moderationChannelId,
      server: config.serverChannelId,
      voice: config.voiceChannelId,
    };

    const channelId = channelIdMap[category];
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId) as
      | TextChannel
      | undefined;
    if (!channel || !("send" in channel)) return;

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error("Event Logger", `Failed to dispatch ${category} log`, error, {
      guildId,
    });
  }
}
