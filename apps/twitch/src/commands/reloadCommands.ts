import { TwitchCommand } from "../types/command.js";
import { commandCache } from "../services/commandCache.js";
import { loadRegulars } from "../services/accessControl.js";

export const reloadCommands: TwitchCommand = {
  name: "reloadcommands",
  description: "Reloads commands and regulars from the database (broadcaster only)",
  async execute(client, channel, user, _args, msg) {
    if (!msg.userInfo.isBroadcaster) {
      return;
    }

    await commandCache.reload();
    await loadRegulars();
    await client.say(channel, `@${user} Commands and regulars reloaded!`);
  },
};
