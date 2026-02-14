import { ChatClient, ChatMessage } from "@twurple/chat";

import { TwitchResponseType } from "@community-bot/db";
import { getRandomChatter } from "./chatterTracker.js";

async function substituteVariables(
  template: string,
  user: string,
  channel: string,
  args: string[]
): Promise<string> {
  let result = template;

  // 1. Simple variables: {user}, {channel}, {args}
  result = result
    .replace(/\{user\}/gi, user)
    .replace(/\{channel\}/gi, channel)
    .replace(/\{args\}/gi, args.join(" "));

  // 2. Positional args: ${N} or ${N|fallback} (1-indexed)
  result = result.replace(
    /\$\{(\d+)(?:\|'?([^}']*)'?)?\}/g,
    (_match, indexStr: string, fallback: string | undefined) => {
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < args.length && args[index]) {
        return args[index];
      }
      return fallback ?? "";
    }
  );

  // 3. ${random.pick '...' '...'} — pick a random option from single-quoted list
  result = result.replace(
    /\$\{random\.pick\s+((?:'[^']*'\s*)+)\}/gi,
    (_match, optionsStr: string) => {
      const options = [...optionsStr.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      if (options.length === 0) return "";
      return options[Math.floor(Math.random() * options.length)];
    }
  );

  // 4. ${random.chatter} — pick a random user currently in chat
  result = result.replace(/\$\{random\.chatter\}/gi, () => {
    return getRandomChatter(channel) ?? user;
  });

  // 5. ${time <timezone>} — current time in a timezone
  result = result.replace(
    /\$\{time\s+([^}]+)\}/gi,
    (_match, timezone: string) => {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: timezone.trim(),
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date());
      } catch {
        return `(invalid timezone: ${timezone.trim()})`;
      }
    }
  );

  return result;
}

export async function executeCommand(
  client: ChatClient,
  channel: string,
  user: string,
  args: string[],
  msg: ChatMessage,
  response: string,
  responseType: TwitchResponseType
): Promise<void> {
  const text = await substituteVariables(response, user, channel, args);

  switch (responseType) {
    case TwitchResponseType.SAY:
      await client.say(channel, text);
      break;
    case TwitchResponseType.MENTION:
      await client.say(channel, `@${user} ${text}`);
      break;
    case TwitchResponseType.REPLY:
      await client.say(channel, text, { replyTo: msg });
      break;
  }
}
