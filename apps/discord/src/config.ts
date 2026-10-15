import { ActivityType, type PresenceData } from "discord.js";

export interface DiscordSettings {
  discordApplicationId: string | null;
  discordGuildId: string | null;
  discordStatus: string;
  discordActivityType: string;
  discordActivityText: string;
  discordActivityUrl?: string | null;
}

export function validateIdentity(settings: DiscordSettings) {
  if (
    !/^\d{17,20}$/.test(settings.discordApplicationId ?? "") ||
    !/^\d{17,20}$/.test(settings.discordGuildId ?? "")
  ) {
    throw new Error(
      "Configure the Discord application and server IDs in the dashboard",
    );
  }
}

export function presence(settings: DiscordSettings): PresenceData {
  const types = {
    playing: ActivityType.Playing,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    competing: ActivityType.Competing,
    custom: ActivityType.Custom,
    streaming: ActivityType.Streaming,
  };
  if (
    !["online", "idle", "dnd", "invisible"].includes(settings.discordStatus)
  ) {
    throw new Error("Invalid Discord status");
  }
  const type = types[settings.discordActivityType as keyof typeof types];
  if (type === undefined || settings.discordActivityText.length > 128) {
    throw new Error("Invalid Discord activity");
  }
  let streamUrl: string | undefined;
  if (type === ActivityType.Streaming) {
    try {
      const url = new URL(settings.discordActivityUrl ?? "");
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        ![
          "twitch.tv",
          "www.twitch.tv",
          "youtube.com",
          "www.youtube.com",
        ].includes(url.hostname)
      ) {
        throw new Error("Unsupported streaming URL");
      }
      streamUrl = url.href;
    } catch {
      throw new Error(
        "Streaming activity needs an HTTPS Twitch or YouTube URL",
      );
    }
  }
  return {
    status: settings.discordStatus as PresenceData["status"],
    activities: settings.discordActivityText.trim()
      ? [
          {
            name: settings.discordActivityText.trim(),
            type,
            ...(streamUrl ? { url: streamUrl } : {}),
            ...(type === ActivityType.Custom
              ? { state: settings.discordActivityText.trim() }
              : {}),
          },
        ]
      : [],
  };
}
