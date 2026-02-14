import { ChatClient } from "@twurple/chat";
import { type AuthProvider } from "@twurple/auth";

import { env } from "../utils/env.js";

export function createChatClient(authProvider: AuthProvider, channels: string[]): ChatClient {
  const client = new ChatClient({
    authProvider,
    channels: [...new Set(channels)],
  });

  if (env.NODE_ENV === "development") {
    const originalSay = client.say.bind(client);
    client.say = (channel: string, text: string, attributes?: object) =>
      originalSay(channel, `[Running in Development mode] ${text}`, attributes);
  }

  return client;
}
