import { prisma } from "@community-bot/db";
import { env } from "@community-bot/env/server";

const HELIX_BASE = "https://api.twitch.tv/helix";

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
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
    return helixFetch<T>(path, false);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch API ${res.status}: ${body}`);
  }

  return (await res.json()) as HelixResponse<T>;
}

export async function getTwitchUserByLogin(
  login: string
): Promise<TwitchUser | undefined> {
  const { data } = await helixFetch<TwitchUser>(
    `/users?login=${encodeURIComponent(login)}`
  );
  return data[0];
}

export async function getTwitchUserById(
  id: string
): Promise<TwitchUser | undefined> {
  const { data } = await helixFetch<TwitchUser>(
    `/users?id=${encodeURIComponent(id)}`
  );
  return data[0];
}
