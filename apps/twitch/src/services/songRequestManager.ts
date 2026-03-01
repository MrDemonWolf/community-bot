/**
 * Song Request Manager — Per-channel song request queue.
 *
 * Manages a song request queue per channel with in-memory settings cache.
 * Viewers can request songs, and moderators can skip, remove, or clear.
 * Supports YouTube metadata and auto-play from playlists.
 */
import { prisma } from "@community-bot/db";
import { TwitchAccessLevel } from "@community-bot/db";
import type { ChatMessage } from "@twurple/chat";
import { getUserAccessLevel, meetsAccessLevel } from "./accessControl.js";
import { getEventBus } from "./eventBusAccessor.js";
import { logger } from "../utils/logger.js";
import type { YouTubeVideoInfo } from "./youtubeService.js";

interface SongRequestSettingsCache {
  enabled: boolean;
  maxQueueSize: number;
  maxPerUser: number;
  minAccessLevel: TwitchAccessLevel;
  maxDuration: number | null;
  autoPlayEnabled: boolean;
  activePlaylistId: string | null;
}

// channel username (lowercase, no #) → cached settings
const settingsCache = new Map<string, SongRequestSettingsCache>();

// channel username → current playlist position (for auto-play)
const playlistPositionCache = new Map<string, number>();

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
      maxDuration: settings.maxDuration,
      autoPlayEnabled: settings.autoPlayEnabled,
      activePlaylistId: settings.activePlaylistId,
    });
  } else {
    settingsCache.set(channelKey, {
      enabled: false,
      maxQueueSize: 50,
      maxPerUser: 5,
      minAccessLevel: TwitchAccessLevel.EVERYONE,
      maxDuration: null,
      autoPlayEnabled: false,
      activePlaylistId: null,
    });
  }

  logger.info("SongRequestManager", `Loaded settings for ${channelKey}`);
}

export async function reloadSettings(channel: string): Promise<void> {
  await loadSettings(channel);
}

export function clearCache(channel: string): void {
  const key = normalize(channel);
  settingsCache.delete(key);
  playlistPositionCache.delete(key);
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
  msg: ChatMessage,
  youtubeInfo?: YouTubeVideoInfo
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

  // Check max duration if YouTube info is provided
  if (settings.maxDuration && youtubeInfo && youtubeInfo.duration > settings.maxDuration) {
    return {
      ok: false,
      reason: `Song exceeds maximum duration (${Math.floor(settings.maxDuration / 60)}:${(settings.maxDuration % 60).toString().padStart(2, "0")}).`,
    };
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
      youtubeVideoId: youtubeInfo?.videoId ?? null,
      youtubeDuration: youtubeInfo?.duration ?? null,
      youtubeThumbnail: youtubeInfo?.thumbnail ?? null,
      youtubeChannel: youtubeInfo?.channelName ?? null,
      source: "viewer",
    },
  });

  publishEvent(botChannelId);
  return { ok: true, position };
}

export async function addFromPlaylist(
  channel: string
): Promise<{ title: string; youtubeVideoId: string | null } | null> {
  const channelKey = normalize(channel);
  const settings = settingsCache.get(channelKey);

  if (!settings?.autoPlayEnabled || !settings.activePlaylistId) {
    return null;
  }

  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return null;

  // Get current position in the playlist
  const currentPos = playlistPositionCache.get(channelKey) ?? 0;
  const nextPos = currentPos + 1;

  const entry = await prisma.playlistEntry.findFirst({
    where: { playlistId: settings.activePlaylistId, position: nextPos },
  });

  if (!entry) {
    // Playlist exhausted — reset position
    playlistPositionCache.set(channelKey, 0);
    return null;
  }

  playlistPositionCache.set(channelKey, nextPos);

  // Get next position in song request queue
  const last = await prisma.songRequest.findFirst({
    where: { botChannelId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  await prisma.songRequest.create({
    data: {
      position,
      title: entry.title,
      requestedBy: "playlist",
      botChannelId,
      youtubeVideoId: entry.youtubeVideoId,
      youtubeDuration: entry.youtubeDuration,
      youtubeThumbnail: entry.youtubeThumbnail,
      youtubeChannel: entry.youtubeChannel,
      source: "playlist",
    },
  });

  publishEvent(botChannelId);
  return { title: entry.title, youtubeVideoId: entry.youtubeVideoId };
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
): Promise<{
  title: string;
  requestedBy: string;
  autoPlaySong?: { title: string; youtubeVideoId: string | null } | null;
} | null> {
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

  // Check if queue is now empty and auto-play is enabled
  const remaining = await prisma.songRequest.count({ where: { botChannelId } });
  let autoPlaySong: { title: string; youtubeVideoId: string | null } | null = null;
  if (remaining === 0) {
    autoPlaySong = await addFromPlaylist(channel);
  }

  return { title: entry.title, requestedBy: entry.requestedBy, autoPlaySong };
}

export async function listRequests(
  channel: string,
  limit = 5
): Promise<Array<{ position: number; title: string; requestedBy: string; youtubeVideoId: string | null; youtubeDuration: number | null }>> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return [];

  return prisma.songRequest.findMany({
    where: { botChannelId },
    orderBy: { position: "asc" },
    take: limit,
    select: { position: true, title: true, requestedBy: true, youtubeVideoId: true, youtubeDuration: true },
  });
}

export async function currentRequest(
  channel: string
): Promise<{ title: string; requestedBy: string; youtubeVideoId: string | null; youtubeDuration: number | null } | null> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return null;

  const entry = await prisma.songRequest.findFirst({
    where: { botChannelId, position: 1 },
    select: { title: true, requestedBy: true, youtubeVideoId: true, youtubeDuration: true },
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

export async function listPlaylists(
  channel: string
): Promise<Array<{ id: string; name: string }>> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return [];

  return prisma.playlist.findMany({
    where: { botChannelId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function activatePlaylist(
  channel: string,
  name: string
): Promise<boolean> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return false;

  const playlist = await prisma.playlist.findFirst({
    where: { botChannelId, name: { equals: name, mode: "insensitive" } },
  });
  if (!playlist) return false;

  await prisma.songRequestSettings.upsert({
    where: { botChannelId },
    update: { activePlaylistId: playlist.id, autoPlayEnabled: true },
    create: { botChannelId, activePlaylistId: playlist.id, autoPlayEnabled: true },
  });

  // Reset position tracker and reload settings
  const channelKey = normalize(channel);
  playlistPositionCache.set(channelKey, 0);
  await reloadSettings(channel);

  return true;
}
