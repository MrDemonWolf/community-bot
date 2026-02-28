import { TwitchCommand } from "../types/command.js";

export const vanish: TwitchCommand = {
  name: "vanish",
  description: "Clear your own messages (self-timeout for 1 second).",
  async execute(client, channel, user) {
    try {
      await client.say(channel, `/timeout ${user} 1 Vanish`);
    } catch {
      // Can't timeout mods/broadcaster — ignore silently
    }
  },
};
