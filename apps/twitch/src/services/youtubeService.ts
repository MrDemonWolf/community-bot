/**
 * YouTube Data API v3 wrapper for looking up video metadata.
 *
 * Used by the song request system to fetch title, duration, thumbnail,
 * and channel name for YouTube URLs or search queries.
 */
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
  channelName: string;
}

const cache = new Map<string, { data: YouTubeVideoInfo; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function isYouTubeEnabled(): boolean {
  return !!env.YOUTUBE_API_KEY;
}

/**
 * Extract a YouTube video ID from a URL, or return null if not a YouTube URL.
 */
export function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parse an ISO 8601 duration (e.g. PT4M33S) to seconds.
 */
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds as MM:SS or H:MM:SS.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function fetchVideoById(videoId: string): Promise<YouTubeVideoInfo | null> {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    logger.warn("YouTubeService", `API error: ${res.status} ${res.statusText}`);
    return null;
  }

  const data: any = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  return {
    videoId: item.id,
    title: item.snippet.title,
    duration: parseDuration(item.contentDetails.duration),
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
    channelName: item.snippet.channelTitle,
  };
}

async function searchVideo(query: string): Promise<YouTubeVideoInfo | null> {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    logger.warn("YouTubeService", `Search API error: ${searchRes.status}`);
    return null;
  }

  const searchData: any = await searchRes.json();
  const searchItem = searchData.items?.[0];
  if (!searchItem) return null;

  return fetchVideoById(searchItem.id.videoId);
}

/**
 * Look up a YouTube video by URL or search query.
 * Returns video info or null if not found / API not configured.
 */
export async function lookupVideo(query: string): Promise<YouTubeVideoInfo | null> {
  if (!isYouTubeEnabled()) return null;

  const cacheKey = query.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const videoId = extractVideoId(query);
    const result = videoId ? await fetchVideoById(videoId) : await searchVideo(query);

    if (result) {
      cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    }

    return result;
  } catch (err) {
    logger.warn("YouTubeService", "Lookup failed", err instanceof Error ? { error: err.message } : undefined);
    return null;
  }
}
