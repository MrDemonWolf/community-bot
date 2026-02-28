import { prisma } from "@community-bot/db";
import { TwitchCommand } from "../types/command.js";

export const permit: TwitchCommand = {
  name: "permit",
  description: "Temporarily allow a user to bypass spam filters.",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isMod && !msg.userInfo.isBroadcaster) {
      return;
    }

    if (args.length < 1) {
      await client.say(channel, `@${user}, usage: !permit <user> [seconds]`);
      return;
    }

    const target = args[0].replace(/^@/, "").toLowerCase();
    const seconds = Math.min(Math.max(parseInt(args[1]) || 60, 1), 3600);

    const channelKey = channel.replace(/^#/, "").toLowerCase();
    const botChannel = await prisma.botChannel.findFirst({
      where: { twitchUsername: channelKey },
      select: { id: true },
    });

    if (!botChannel) return;

    await prisma.spamPermit.create({
      data: {
        username: target,
        botChannelId: botChannel.id,
        expiresAt: new Date(Date.now() + seconds * 1000),
      },
    });

    await client.say(
      channel,
      `@${target} has been permitted for ${seconds} seconds.`
    );
  },
};
