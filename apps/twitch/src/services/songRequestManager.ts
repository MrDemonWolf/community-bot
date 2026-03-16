/**
 * Song Request Manager — Per-channel song request queue.
 *
 * Manages a song request queue per channel with in-memory settings cache.
 * Viewers can request songs, and moderators can skip, remove, or clear.
 * Supports YouTube metadata and auto-play from playlists.
 */
import { db, eq, and, count, desc, asc, sql, inArray } from "@community-bot/db";
import { botChannels, songRequests, songRequestSettings, playlistEntries, playlists } from "@community-bot/db";
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
  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.twitchUsername, username),
    columns: { id: true },
  });
  return botChannel?.id ?? null;
}

export async function loadSettings(channel: string): Promise<void> {
  const channelKey = normalize(channel);
  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.twitchUsername, channelKey),
    columns: { id: true },
  });

  if (!botChannel) return;

  const settings = await db.query.songRequestSettings.findFirst({
    where: eq(songRequestSettings.botChannelId, botChannel.id),
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
  const [{ value: queueSize }] = await db
    .select({ value: count() })
    .from(songRequests)
    .where(eq(songRequests.botChannelId, botChannelId));
  if (queueSize >= settings.maxQueueSize) {
    return { ok: false, reason: "The song request queue is full." };
  }

  // Check per-user limit
  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(songRequests)
    .where(
      and(
        eq(songRequests.botChannelId, botChannelId),
        eq(songRequests.requestedBy, username.toLowerCase())
      )
    );
  if (userCount >= settings.maxPerUser) {
    return { ok: false, reason: `You can only have ${settings.maxPerUser} song(s) in the queue.` };
  }

  // Get next position
  const last = await db.query.songRequests.findFirst({
    where: eq(songRequests.botChannelId, botChannelId),
    orderBy: desc(songRequests.position),
    columns: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  await db.insert(songRequests).values({
    position,
    title,
    requestedBy: username.toLowerCase(),
    botChannelId,
    youtubeVideoId: youtubeInfo?.videoId ?? null,
    youtubeDuration: youtubeInfo?.duration ?? null,
    youtubeThumbnail: youtubeInfo?.thumbnail ?? null,
    youtubeChannel: youtubeInfo?.channelName ?? null,
    source: "viewer",
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

  const entry = await db.query.playlistEntries.findFirst({
    where: and(
      eq(playlistEntries.playlistId, settings.activePlaylistId),
      eq(playlistEntries.position, nextPos)
    ),
  });

  if (!entry) {
    // Playlist exhausted — reset position
    playlistPositionCache.set(channelKey, 0);
    return null;
  }

  playlistPositionCache.set(channelKey, nextPos);

  // Get next position in song request queue
  const last = await db.query.songRequests.findFirst({
    where: eq(songRequests.botChannelId, botChannelId),
    orderBy: desc(songRequests.position),
    columns: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  await db.insert(songRequests).values({
    position,
    title: entry.title,
    requestedBy: "playlist",
    botChannelId,
    youtubeVideoId: entry.youtubeVideoId,
    youtubeDuration: entry.youtubeDuration,
    youtubeThumbnail: entry.youtubeThumbnail,
    youtubeChannel: entry.youtubeChannel,
    source: "playlist",
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

  const entry = await db.query.songRequests.findFirst({
    where: and(
      eq(songRequests.botChannelId, botChannelId),
      eq(songRequests.position, position)
    ),
  });
  if (!entry) return false;

  await db.transaction(async (tx) => {
    await tx.delete(songRequests).where(eq(songRequests.id, entry.id));
    await tx.execute(
      sql`UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = ${botChannelId} AND position > ${position}`
    );
  });

  publishEvent(botChannelId);
  return true;
}

export async function removeByUser(
  channel: string,
  username: string
): Promise<number> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return 0;

  const entries = await db.query.songRequests.findMany({
    where: and(
      eq(songRequests.botChannelId, botChannelId),
      eq(songRequests.requestedBy, username.toLowerCase())
    ),
    orderBy: desc(songRequests.position),
  });

  if (entries.length === 0) return 0;

  // Delete all user entries and reorder in a single transaction
  const ids = entries.map((e) => e.id);
  await db.transaction(async (tx) => {
    await tx.delete(songRequests).where(inArray(songRequests.id, ids));
    await tx.execute(
      sql`UPDATE "SongRequest" SET position = sub.row_num
      FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY position) AS row_num FROM "SongRequest" WHERE "botChannelId" = ${botChannelId}) sub
      WHERE "SongRequest".id = sub.id`
    );
  });

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

  const entry = await db.query.songRequests.findFirst({
    where: and(
      eq(songRequests.botChannelId, botChannelId),
      eq(songRequests.position, 1)
    ),
  });
  if (!entry) return null;

  await db.transaction(async (tx) => {
    await tx.delete(songRequests).where(eq(songRequests.id, entry.id));
    await tx.execute(
      sql`UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = ${botChannelId} AND position > 1`
    );
  });

  publishEvent(botChannelId);

  // Check if queue is now empty and auto-play is enabled
  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(songRequests)
    .where(eq(songRequests.botChannelId, botChannelId));
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

  return db.query.songRequests.findMany({
    where: eq(songRequests.botChannelId, botChannelId),
    orderBy: asc(songRequests.position),
    limit,
    columns: { position: true, title: true, requestedBy: true, youtubeVideoId: true, youtubeDuration: true },
  });
}

export async function currentRequest(
  channel: string
): Promise<{ title: string; requestedBy: string; youtubeVideoId: string | null; youtubeDuration: number | null } | null> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return null;

  const entry = await db.query.songRequests.findFirst({
    where: and(
      eq(songRequests.botChannelId, botChannelId),
      eq(songRequests.position, 1)
    ),
    columns: { title: true, requestedBy: true, youtubeVideoId: true, youtubeDuration: true },
  });
  return entry ?? null;
}

export async function clearRequests(channel: string): Promise<void> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return;

  await db.delete(songRequests).where(eq(songRequests.botChannelId, botChannelId));
  publishEvent(botChannelId);
}

export async function getQueueCount(channel: string): Promise<number> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return 0;

  const [{ value }] = await db
    .select({ value: count() })
    .from(songRequests)
    .where(eq(songRequests.botChannelId, botChannelId));
  return value;
}

export async function listPlaylists(
  channel: string
): Promise<Array<{ id: string; name: string }>> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return [];

  return db.query.playlists.findMany({
    where: eq(playlists.botChannelId, botChannelId),
    columns: { id: true, name: true },
    orderBy: asc(playlists.name),
  });
}

export async function activatePlaylist(
  channel: string,
  name: string
): Promise<boolean> {
  const botChannelId = await getBotChannelId(channel);
  if (!botChannelId) return false;

  const playlist = await db.query.playlists.findFirst({
    where: and(
      eq(playlists.botChannelId, botChannelId),
      sql`lower(${playlists.name}) = lower(${name})`
    ),
  });
  if (!playlist) return false;

  await db
    .insert(songRequestSettings)
    .values({ botChannelId, activePlaylistId: playlist.id, autoPlayEnabled: true })
    .onConflictDoUpdate({
      target: songRequestSettings.botChannelId,
      set: { activePlaylistId: playlist.id, autoPlayEnabled: true },
    });

  // Reset position tracker and reload settings
  const channelKey = normalize(channel);
  playlistPositionCache.set(channelKey, 0);
  await reloadSettings(channel);

  return true;
}
