import { TwitchCommand } from "../types/command.js";

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const filesay: TwitchCommand = {
  name: "filesay",
  description: "Fetch a text file and send each line to chat (broadcaster only).",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isBroadcaster) return;

    const url = args[0];
    if (!url) {
      await client.say(channel, `@${user}, usage: !filesay <url>`);
      return;
    }

    if (!isValidUrl(url)) {
      await client.say(channel, `@${user}, invalid URL.`);
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        await client.say(channel, `@${user}, failed to fetch file (${res.status}).`);
        return;
      }

      const text = await res.text();
      const lines = text.split("\n").filter((line) => line.trim().length > 0);

      if (lines.length === 0) {
        await client.say(channel, `@${user}, the file is empty.`);
        return;
      }

      for (const line of lines) {
        await client.say(channel, line);
        await delay(1000);
      }
    } catch {
      await client.say(channel, `@${user}, failed to fetch the file.`);
    }
  },
};
