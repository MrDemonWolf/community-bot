import { prisma } from "@community-bot/db";
import { logger } from "../utils/logger.js";

const broadcasterIds = new Map<string, string>();

export async function loadBroadcasterIds(): Promise<void> {
  const channels = await prisma.botChannel.findMany({
    select: { twitchUsername: true, twitchUserId: true },
  });
  broadcasterIds.clear();
  for (const ch of channels) {
    broadcasterIds.set(ch.twitchUsername.toLowerCase(), ch.twitchUserId);
  }
  logger.info("BroadcasterCache", `Loaded ${broadcasterIds.size} broadcaster IDs`);
}

export function getBroadcasterId(channel: string): string | undefined {
  const key = channel.replace(/^#/, "").toLowerCase();
  return broadcasterIds.get(key);
}

const botChannelIds = new Map<string, string>();

export async function loadBotChannelIds(): Promise<void> {
  const channels = await prisma.botChannel.findMany({
    select: { id: true, twitchUsername: true },
  });
  botChannelIds.clear();
  for (const ch of channels) {
    botChannelIds.set(ch.twitchUsername.toLowerCase(), ch.id);
  }
}

export function getBotChannelId(channel: string): string | undefined {
  const key = channel.replace(/^#/, "").toLowerCase();
  return botChannelIds.get(key);
}
