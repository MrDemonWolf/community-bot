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

  // Bot status
  "bot:status": {
    service: "discord" | "twitch";
    status: "online" | "offline" | "connecting";
  };
}

export type EventName = keyof EventMap;
