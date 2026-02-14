import { TwitchCommand } from "../types/command.js";

export const ping: TwitchCommand = {
  name: "ping",
  description: "Replies with Pong!",
  async execute(client, channel, user) {
    await client.say(channel, `@${user} Pong!`);
  },
};
