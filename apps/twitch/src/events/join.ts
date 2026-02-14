import { ChatClient } from "@twurple/chat";

import { trackJoin } from "../services/chatterTracker.js";
import { logger } from "../utils/logger.js";

export function registerJoinEvents(chatClient: ChatClient): void {
  chatClient.onJoin((channel, user) => {
    trackJoin(channel, user);
    logger.twitch.channelJoined(channel, user);
  });

  chatClient.onJoinFailure((channel, reason) => {
    logger.twitch.channelJoinFailed(channel, reason);
  });
}
