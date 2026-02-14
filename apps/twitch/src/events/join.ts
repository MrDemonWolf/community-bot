import { ChatClient } from "@twurple/chat";
import consola from "consola";

import { trackJoin } from "../services/chatterTracker.js";

export function registerJoinEvents(chatClient: ChatClient): void {
  chatClient.onJoin((channel, user) => {
    trackJoin(channel, user);
    consola.info({
      message: `[Twitch Event - Join] ${user} joined ${channel}`,
      badge: true,
      timestamp: new Date(),
    });
  });

  chatClient.onJoinFailure((channel, reason) => {
    consola.error({
      message: `[Twitch Event - Join] Failed to join ${channel}: ${reason}`,
      badge: true,
      timestamp: new Date(),
    });
  });
}
