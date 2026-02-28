import { TwitchCommand } from "../types/command.js";
import { getRecentMessages } from "../services/chatterTracker.js";

export const nuke: TwitchCommand = {
  name: "nuke",
  description: "Timeout all recent users who said a specific word/phrase.",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isMod && !msg.userInfo.isBroadcaster) {
      return;
    }

    if (args.length < 1) {
      await client.say(channel, `@${user}, usage: !nuke <word/phrase> [seconds]`);
      return;
    }

    // Last arg might be a number (duration), rest is the phrase
    const lastArg = args[args.length - 1];
    let duration = 300;
    let phrase: string;

    if (args.length > 1 && /^\d+$/.test(lastArg)) {
      duration = Math.min(Math.max(parseInt(lastArg), 1), 86400);
      phrase = args.slice(0, -1).join(" ").toLowerCase();
    } else {
      phrase = args.join(" ").toLowerCase();
    }

    const channelKey = channel.replace(/^#/, "").toLowerCase();
    const messages = getRecentMessages(channelKey);

    // Find unique users who said the phrase
    const usersToTimeout = new Set<string>();
    for (const m of messages) {
      if (m.text.toLowerCase().includes(phrase)) {
        usersToTimeout.add(m.username);
      }
    }

    // Don't timeout the mod who issued the command or the broadcaster
    usersToTimeout.delete(user.toLowerCase());

    let count = 0;
    for (const target of usersToTimeout) {
      try {
        await client.say(channel, `/timeout ${target} ${duration} Nuked: "${phrase}"`);
        count++;
      } catch {
        // Skip users that can't be timed out (mods, etc.)
      }
    }

    await client.say(
      channel,
      `Nuked ${count} user(s) for "${phrase}" (${duration}s timeout).`
    );
  },
};
