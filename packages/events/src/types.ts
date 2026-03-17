/**
 * Event type registry for the EventBus.
 *
 * Each key is an event name and its value is the payload shape. Adding a
 * new event here automatically provides type safety in `publish()` and
 * `on()` calls across all services.
 */
export interface EventMap {
  // Twitch channel management
  "channel:join": { channelId: string; username: string };
  "channel:leave": { channelId: string; username: string };

  // Command lifecycle
  "command:created": { commandId: string };
  "command:updated": { commandId: string };
  "command:deleted": { commandId: string };

  // Regular (trusted user) changes
  "regular:created": { twitchUserId?: string; discordUserId?: string };
  "regular:deleted": { twitchUserId?: string; discordUserId?: string };

  // Stream status (published by Twitch bot)
  "stream:online": {
    channelId: string;
    username: string;
    title: string;
    startedAt: string;
  };
  "stream:offline": { channelId: string; username: string };

  // Queue events
  "queue:updated": { channelId: string };

  // Bot mute/unmute
  "bot:mute": { channelId: string; username: string; muted: boolean };

  // Default commands toggled
  "commands:defaults-updated": { channelId: string };

  // Discord settings
  "discord:settings-updated": { guildId: string };

  // Discord bot mute/unmute
  "discord:mute": { guildId: string; muted: boolean };

  // Discord test notification (triggered from web dashboard)
  "discord:test-notification": { guildId: string };

  // Quote lifecycle
  "quote:created": { quoteId: string };
  "quote:deleted": { quoteId: string };

  // Counter changes
  "counter:updated": { counterName: string; channelId: string };

  // Timer changes
  "timer:updated": { channelId: string };

  // Spam filter changes
  "spam-filter:updated": { channelId: string };

  // Song request changes
  "song-request:updated": { channelId: string };
  "song-request:settings-updated": { channelId: string };

  // Playlist events
  "playlist:created": { playlistId: string; channelId: string };
  "playlist:updated": { playlistId: string; channelId: string };
  "playlist:deleted": { playlistId: string; channelId: string };
  "playlist:activated": { playlistId: string | null; channelId: string };

  // Giveaway events
  "giveaway:started": { giveawayId: string; channelId: string };
  "giveaway:ended": { giveawayId: string; channelId: string };
  "giveaway:winner": { giveawayId: string; channelId: string };

  // Discord moderation cases
  "discord:case-created": { caseId: string; guildId: string };

  // Discord scheduled messages
  "discord:scheduled-send": { scheduledMessageId: string; guildId: string };

  // Discord custom commands updated
  "discord:commands-updated": { guildId: string };

  // Discord log config updated
  "discord:log-config-updated": { guildId: string };

  // Bot status
  "bot:status": {
    service: "discord" | "twitch";
    status: "online" | "offline" | "connecting";
  };

  // Feature 2: Keyword lifecycle
  "keyword:created": { keywordId: string };
  "keyword:updated": { keywordId: string };
  "keyword:deleted": { keywordId: string };

  // Feature 4: Chat Alert config updated
  "alert:updated": { channelId: string };

  // Feature 5: Channel Points
  "channel-points:updated": { channelId: string };
  "channel-points:redeemed": { channelId: string; rewardId: string; redemptionId: string; username: string; userInput: string };

  // Feature 7: AutoMod
  "automod:held": { channelId: string; messageId: string; userId: string; username: string; text: string };
  "automod:resolved": { channelId: string; messageId: string; action: "approved" | "denied" };
  "automod:settings-updated": { channelId: string };
}

export type EventName = keyof EventMap;
