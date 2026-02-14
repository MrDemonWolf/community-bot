import { prisma } from "@community-bot/db";
import { env } from "../utils/env.js";

export interface HelixResponse<T = unknown> {
  data: T[];
  pagination?: { cursor?: string };
}

export async function helixFetch<T = unknown>(
  endpoint: string,
  params: Record<string, string>
): Promise<HelixResponse<T>> {
  const cred = await prisma.twitchCredential.findFirst();
  const accessToken = cred?.accessToken ?? "";

  const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": env.TWITCH_APPLICATION_CLIENT_ID,
    },
  });

  if (!res.ok) {
    throw new Error(`Helix API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<HelixResponse<T>>;
}
