import { TwitchCommand } from "../types/command.js";
import { env } from "../utils/env.js";

export const commandsPage: TwitchCommand = {
  name: "commands",
  description: "Shows link to the public commands list",
  async execute(client, channel, user) {
    const baseUrl = env.WEB_URL;
    if (!baseUrl) {
      await client.say(channel, `@${user} Commands page URL is not configured.`);
      return;
    }
    const url = `${baseUrl.replace(/\/$/, "")}/p/commands`;
    await client.say(channel, `@${user} View all commands here: ${url}`);
  },
};
