import { prisma } from "@community-bot/db";
import { env } from "../utils/env.js";

export async function helixFetch(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
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

  return res.json();
}
