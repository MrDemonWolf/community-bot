import { ChatClient } from "@twurple/chat";

import { trackPart } from "../services/chatterTracker.js";
import { logger } from "../utils/logger.js";

export function registerPartEvents(chatClient: ChatClient): void {
  chatClient.onPart((channel, user) => {
    trackPart(channel, user);
    logger.twitch.channelParted(channel, user);
  });
}
