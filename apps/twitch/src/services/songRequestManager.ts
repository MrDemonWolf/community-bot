/**
 * Song Request Manager — Per-channel song request queue.
 *
 * Manages a song request queue per channel with in-memory settings cache.
 * Viewers can request songs, and moderators can skip, remove, or clear.
 */
import { prisma } from "@community-bot/db";
import { TwitchAccessLevel } from "@community-bot/db";
import type { ChatMessage } from "@twurple/chat";
import { getUserAccessLevel, meetsAccessLevel } from "./accessControl.js";
import { getEventBus } from "./eventBusAccessor.js";
import { logger } from "../utils/logger.js";

interface SongRequestSettingsCache {
  enabled: boolean;
  maxQueueSize: number;
  maxPerUser: number;
  minAccessLevel: TwitchAccessLevel;
}

// channel username (lowercase, no #) → cached settings
const settingsCache = new Map<string, SongRequestSettingsCache>();

function normalize(channel: string): string {
  return channel.replace(/^#/, "").toLowerCase();
}

function publishEvent(channelId: string): void {
  try {
    const eventBus = getEventBus();
    eventBus.publish("song-request:updated", { channelId });
  } catch {
    // EventBus may not be initialized during early startup
  }
}

async function getBotChannelId(channel: string): Promise<string | null> {
  const username = normalize(channel);
  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: username },
    select: { id: true },
  });
  return botChannel?.id ?? null;
}

export async function loadSettings(channel: string): Promise<void> {
  const channelKey = normalize(channel);
  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: channelKey },
    select: { id: true },
  });

  if (!botChannel) return;

  const settings = await prisma.songRequestSettings.findUnique({
    where: { botChannelId: botChannel.id },
  });

  if (settings) {
    settingsCache.set(channelKey, {
      enabled: settings.enabled,
      maxQueueSize: settings.maxQueueSize,
      maxPerUser: settings.maxPerUser,
      minAccessLevel: settings.minAccessLevel,
    });
  } else {
    settingsCache.set(channelKey, {
      enabled: false,
      maxQueueSize: 50,
      maxPerUser: 5,
      minAccessLevel: TwitchAccessLevel.EVERYONE,
    });
  }

  logger.info("SongRequestManager", `Loaded settings for ${channelKey}`);
}

export async function reloadSettings(channel: string): Promise<void> {
  await loadSettings(channel);
}

export function clearCache(channel: string): void {
  settingsCache.delete(normalize(channel));
}

export function isEnabled(channel: string): boolean {
  return settingsCache.get(normalize(channel))?.enabled ?? false;
}

export function getSettings(channel: string): SongRequestSettingsCache | null {
  return settingsCache.get(normalize(channel)) ?? null;
}

export async function addRequest(
  channel: string,
  title: string,
  username: string,
  msg: ChatMessage
): Promise<{ ok: true; position: number } | { ok: false; reason: string }> {
  const channelKey = normalize(channel);
  const settings = settingsCache.get(channelKey);

  if (!settings?.enabled) {
    return { ok: false, reason: "Song requests are not enabled." };
  }

  // Check access level
  const userLevel = getUserAccessLevel(msg);
  if (!meetsAccessLevel(userLevel, settings.minAccessLevel)) {
    return { ok: false, reason: "You don't have permission to request songs." };
  }

  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) {
    return { ok: false, reason: "Bot channel not configured." };
  }

  // Check queue size limit
  const queueSize = await prisma.songRequest.count({
    where: { botChannelId },
  });
  if (queueSize >= settings.maxQueueSize) {
    return { ok: false, reason: "The song request queue is full." };
  }

  // Check per-user limit
  const userCount = await prisma.songRequest.count({
    where: { botChannelId, requestedBy: username.toLowerCase() },
  });
  if (userCount >= settings.maxPerUser) {
    return { ok: false, reason: `You can only have ${settings.maxPerUser} song(s) in the queue.` };
  }

  // Get next position
  const last = await prisma.songRequest.findFirst({
    where: { botChannelId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  await prisma.songRequest.create({
    data: {
      position,
      title,
      requestedBy: username.toLowerCase(),
      botChannelId,
    },
  });

  publishEvent(botChannelId);
  return { ok: true, position };
}

export async function removeRequest(
  channel: string,
  position: number
): Promise<boolean> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return false;

  const entry = await prisma.songRequest.findFirst({
    where: { botChannelId, position },
  });
  if (!entry) return false;

  await prisma.songRequest.delete({ where: { id: entry.id } });

  // Reorder positions
  await prisma.$executeRawUnsafe(
    `UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = $1 AND position > $2`,
    botChannelId,
    position
  );

  publishEvent(botChannelId);
  return true;
}

export async function removeByUser(
  channel: string,
  username: string
): Promise<number> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return 0;

  const entries = await prisma.songRequest.findMany({
    where: { botChannelId, requestedBy: username.toLowerCase() },
    orderBy: { position: "desc" },
  });

  if (entries.length === 0) return 0;

  for (const entry of entries) {
    await prisma.songRequest.delete({ where: { id: entry.id } });
    await prisma.$executeRawUnsafe(
      `UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = $1 AND position > $2`,
      botChannelId,
      entry.position
    );
  }

  publishEvent(botChannelId);
  return entries.length;
}

export async function skipRequest(
  channel: string
): Promise<{ title: string; requestedBy: string } | null> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return null;

  const entry = await prisma.songRequest.findFirst({
    where: { botChannelId, position: 1 },
  });
  if (!entry) return null;

  await prisma.songRequest.delete({ where: { id: entry.id } });

  // Reorder positions
  await prisma.$executeRawUnsafe(
    `UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = $1 AND position > 1`,
    botChannelId
  );

  publishEvent(botChannelId);
  return { title: entry.title, requestedBy: entry.requestedBy };
}

export async function listRequests(
  channel: string,
  limit = 5
): Promise<Array<{ position: number; title: string; requestedBy: string }>> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return [];

  return prisma.songRequest.findMany({
    where: { botChannelId },
    orderBy: { position: "asc" },
    take: limit,
    select: { position: true, title: true, requestedBy: true },
  });
}

export async function currentRequest(
  channel: string
): Promise<{ title: string; requestedBy: string } | null> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return null;

  const entry = await prisma.songRequest.findFirst({
    where: { botChannelId, position: 1 },
    select: { title: true, requestedBy: true },
  });
  return entry ?? null;
}

export async function clearRequests(channel: string): Promise<void> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return;

  await prisma.songRequest.deleteMany({ where: { botChannelId } });
  publishEvent(botChannelId);
}

export async function getQueueCount(channel: string): Promise<number> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return 0;

  return prisma.songRequest.count({ where: { botChannelId } });
}
