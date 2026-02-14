import { ChatClient } from "@twurple/chat";
import { type AuthProvider } from "@twurple/auth";

import { env } from "../utils/env.js";

export function createChatClient(authProvider: AuthProvider, botUsername: string): ChatClient {
  const channels = [botUsername, env.TWITCH_CHANNEL];

  return new ChatClient({
    authProvider,
    channels: [...new Set(channels)],
  });
}
