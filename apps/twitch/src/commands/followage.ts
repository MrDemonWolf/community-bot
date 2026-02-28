import { TwitchCommand } from "../types/command.js";
import { getFollowage } from "../services/helixHelpers.js";
import { getBroadcasterId } from "../services/broadcasterCache.js";

export const followage: TwitchCommand = {
  name: "followage",
  description: "Shows how long a user has followed the channel.",
  async execute(client, channel, user, args, msg) {
    const broadcasterId = getBroadcasterId(channel);
    if (!broadcasterId) {
      await client.say(channel, `@${user}, unable to look up followage.`);
      return;
    }

    const targetUserId = msg.userInfo.userId;
    const targetName = user;

    const duration = await getFollowage(broadcasterId, targetUserId);
    await client.say(channel, `@${targetName} has been following for ${duration}.`);
  },
};
