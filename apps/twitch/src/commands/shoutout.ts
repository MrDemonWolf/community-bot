import { prisma } from "@community-bot/db";
import { TwitchCommand } from "../types/command.js";
import { helixFetch } from "../services/helixClient.js";
import { generateShoutout, isAiShoutoutGloballyEnabled } from "../services/aiShoutout.js";

interface ChannelInfo {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  game_name: string;
  title: string;
}

async function getChannelInfo(username: string): Promise<ChannelInfo | null> {
  try {
    // First look up user ID by login name
    const userRes = await helixFetch<{ id: string; login: string; display_name: string }>(
      "users",
      { login: username.toLowerCase() }
    );
    const user = userRes.data[0];
    if (!user) return null;

    // Then get channel info
    const channelRes = await helixFetch<ChannelInfo>(
      "channels",
      { broadcaster_id: user.id }
    );
    return channelRes.data[0] ?? null;
  } catch {
    return null;
  }
}

async function isAiEnabledForChannel(channel: string): Promise<boolean> {
  if (!isAiShoutoutGloballyEnabled()) return false;

  const channelKey = channel.replace(/^#/, "").toLowerCase();
  try {
    const botChannel = await prisma.botChannel.findFirst({
      where: { twitchUsername: channelKey },
      select: { aiShoutoutEnabled: true },
    });
    return botChannel?.aiShoutoutEnabled ?? false;
  } catch {
    return false;
  }
}

export const shoutout: TwitchCommand = {
  name: "shoutout",
  description: "Shout out a streamer with their last game/stream info.",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isMod && !msg.userInfo.isBroadcaster) {
      return;
    }

    if (args.length < 1) {
      await client.say(channel, `@${user}, usage: !so <username>`);
      return;
    }

    const target = args[0].replace(/^@/, "").toLowerCase();
    const info = await getChannelInfo(target);

    if (!info) {
      await client.say(channel, `@${user}, could not find channel "${target}".`);
      return;
    }

    const gamePart = info.game_name ? ` They were last playing ${info.game_name}.` : "";
    await client.say(
      channel,
      `Go check out ${info.broadcaster_name} at https://twitch.tv/${info.broadcaster_login} !${gamePart}`
    );

    // AI-enhanced shoutout — runs after the standard one, non-blocking on failure
    if (await isAiEnabledForChannel(channel)) {
      try {
        const aiMessage = await generateShoutout(target);
        if (aiMessage) {
          await client.say(channel, aiMessage);
        }
      } catch {
        // AI failure doesn't affect the standard shoutout
      }
    }
  },
};
