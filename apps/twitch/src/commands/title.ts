import { TwitchCommand } from "../types/command.js";
import { getTitle } from "../services/streamStatusManager.js";

export const title: TwitchCommand = {
  name: "title",
  description: "Shows the current stream title.",
  async execute(client, channel, user) {
    const currentTitle = getTitle(channel);
    if (currentTitle) {
      await client.say(channel, `Current title: ${currentTitle}`);
    } else {
      await client.say(channel, `@${user}, no title set or stream is offline.`);
    }
  },
};
