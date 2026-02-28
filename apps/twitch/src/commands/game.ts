import { TwitchCommand } from "../types/command.js";
import { getGame } from "../services/streamStatusManager.js";

export const game: TwitchCommand = {
  name: "game",
  description: "Shows the current game/category.",
  async execute(client, channel, user) {
    const currentGame = getGame(channel);
    if (currentGame) {
      await client.say(channel, `Current game: ${currentGame}`);
    } else {
      await client.say(channel, `@${user}, no game set or stream is offline.`);
    }
  },
};
