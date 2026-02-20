import { TwitchCommand } from "../types/command.js";
import {
  isLive,
  getStreamStartedAt,
  getWentOfflineAt,
} from "../services/streamStatusManager.js";

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0) parts.push(`${seconds % 60}s`);

  return parts.join(" ");
}

export const uptime: TwitchCommand = {
  name: "uptime",
  description: "Shows how long the stream has been live or offline",
  async execute(client, channel) {
    const channelName = channel.replace("#", "");

    if (isLive()) {
      const startedAt = getStreamStartedAt();
      if (startedAt) {
        const duration = formatDuration(Date.now() - startedAt.getTime());
        await client.say(channel, `${channelName} has been live for ${duration}`);
      } else {
        await client.say(channel, `${channelName} is currently live`);
      }
    } else {
      const offlineAt = getWentOfflineAt();
      if (offlineAt) {
        const duration = formatDuration(Date.now() - offlineAt.getTime());
        await client.say(channel, `${channelName} has been offline for ${duration}`);
      } else {
        await client.say(channel, `${channelName} is currently offline`);
      }
    }
  },
};
