import { TwitchCommand } from "../types/command.js";
import { setMuted } from "../services/botState.js";

export const bot: TwitchCommand = {
  name: "bot",
  description: "Bot management commands (broadcaster only).",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isBroadcaster) return;

    const sub = args[0]?.toLowerCase();

    if (sub === "mute") {
      setMuted(true);
      await client.say(channel, `@${user}, I have been muted.`);
    } else if (sub === "unmute") {
      setMuted(false);
      await client.say(channel, `@${user}, I have been unmuted.`);
    }
  },
};
