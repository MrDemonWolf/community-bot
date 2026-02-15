import { env } from "@community-bot/env/server";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function discordFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${DISCORD_API_BASE}${path}`, {
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Discord API error: ${res.status} ${res.statusText} for ${path}`
    );
  }

  return res.json() as Promise<T>;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}
