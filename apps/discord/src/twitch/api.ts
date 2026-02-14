import { prisma } from "@community-bot/db";
import env from "../utils/env.js";
import logger from "../utils/logger.js";

const HELIX_BASE = "https://api.twitch.tv/helix";

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  type: string;
}

interface HelixResponse<T> {
  data: T[];
}

async function getAccessToken(): Promise<string> {
  const credential = await prisma.twitchCredential.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!credential) {
    throw new Error(
      "No Twitch credentials found in database. Ensure the auth service has stored tokens."
    );
  }

  return credential.accessToken;
}

async function helixFetch<T>(
  path: string,
  retry = true
): Promise<HelixResponse<T>> {
  const token = await getAccessToken();

  const res = await fetch(`${HELIX_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": env.TWITCH_APPLICATION_CLIENT_ID,
    },
  });

  if (res.status === 401 && retry) {
    logger.warn(
      "Twitch API",
      "Got 401, re-reading token from DB and retrying"
    );
    // Token may have just been refreshed by the auth service — retry once
    return helixFetch<T>(path, false);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch API ${res.status}: ${body}`);
  }

  return (await res.json()) as HelixResponse<T>;
}

export async function getTwitchUser(
  login: string
): Promise<TwitchUser | undefined> {
  const { data } = await helixFetch<TwitchUser>(
    `/users?login=${encodeURIComponent(login)}`
  );
  return data[0];
}

export async function getStreams(userIds: string[]): Promise<TwitchStream[]> {
  if (userIds.length === 0) return [];

  const allStreams: TwitchStream[] = [];

  // Helix supports up to 100 user_id params per request
  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const params = batch.map((id) => `user_id=${id}`).join("&");
    const { data } = await helixFetch<TwitchStream>(`/streams?${params}`);
    allStreams.push(...data);
  }

  return allStreams;
}

export function getStreamThumbnailUrl(
  templateUrl: string,
  width = 1280,
  height = 720
): string {
  return templateUrl
    .replace("{width}", String(width))
    .replace("{height}", String(height));
}

export type { TwitchUser, TwitchStream };
