export interface EventMap {
  // Twitch channel management
  "channel:join": { channelId: string; username: string };
  "channel:leave": { channelId: string; username: string };

  // Command lifecycle
  "command:created": { commandId: string };
  "command:updated": { commandId: string };
  "command:deleted": { commandId: string };

  // Regular (trusted user) changes
  "regular:created": { twitchUserId: string };
  "regular:deleted": { twitchUserId: string };

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

  // Bot status
  "bot:status": {
    service: "discord" | "twitch";
    status: "online" | "offline" | "connecting";
  };
}

export type EventName = keyof EventMap;
