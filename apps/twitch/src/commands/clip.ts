import { TwitchCommand } from "../types/command.js";
import { getBroadcasterId } from "../services/broadcasterCache.js";
import { prisma } from "@community-bot/db";
import { env } from "../utils/env.js";

export const clip: TwitchCommand = {
  name: "clip",
  description: "Create a Twitch clip of the current stream.",
  async execute(client, channel, user) {
    const channelKey = channel.replace(/^#/, "").toLowerCase();
    const broadcasterId = getBroadcasterId(channel);

    if (!broadcasterId) {
      await client.say(channel, `@${user}, could not determine broadcaster ID.`);
      return;
    }

    try {
      const cred = await prisma.twitchCredential.findFirst();
      const accessToken = cred?.accessToken ?? "";

      const res = await fetch("https://api.twitch.tv/helix/clips?broadcaster_id=" + broadcasterId, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": env.TWITCH_APPLICATION_CLIENT_ID,
        },
      });

      if (!res.ok) {
        await client.say(channel, `@${user}, failed to create clip. Is the stream live?`);
        return;
      }

      const body = await res.json() as { data: { id: string; edit_url: string }[] };
      const clipData = body.data?.[0];

      if (!clipData) {
        await client.say(channel, `@${user}, failed to create clip.`);
        return;
      }

      await client.say(
        channel,
        `@${user}, clip created! https://clips.twitch.tv/${clipData.id}`
      );
    } catch {
      await client.say(channel, `@${user}, an error occurred creating the clip.`);
    }
  },
};
