import { ChatClient } from "@twurple/chat";
import consola from "consola";

import { trackPart } from "../services/chatterTracker.js";

export function registerPartEvents(chatClient: ChatClient): void {
  chatClient.onPart((channel, user) => {
    trackPart(channel, user);
    consola.info({
      message: `[Twitch Event - Part] ${user} left ${channel}`,
      badge: true,
      timestamp: new Date(),
    });
  });
}
