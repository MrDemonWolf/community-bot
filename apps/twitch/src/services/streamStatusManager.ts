import cron from "node-cron";
import consola from "consola";

import type { EventBus } from "@community-bot/events";

const HELIX_STREAMS_URL = "https://api.twitch.tv/helix/streams";

interface ChannelStatus {
  live: boolean;
  streamTitle: string;
  streamStartedAt: Date | null;
  wentOfflineAt: Date | null;
}

const channelStatuses = new Map<string, ChannelStatus>();

function getOrCreate(channel: string): ChannelStatus {
  let status = channelStatuses.get(channel);
  if (!status) {
    status = { live: false, streamTitle: "", streamStartedAt: null, wentOfflineAt: null };
    channelStatuses.set(channel, status);
  }
  return status;
}

async function poll(
  channelName: string,
  clientId: string,
  getAccessToken: () => Promise<string>,
  eventBus?: EventBus
): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    const url = `${HELIX_STREAMS_URL}?user_login=${encodeURIComponent(channelName)}`;
    const res = await fetch(url, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      consola.warn(`[StreamStatus] Helix API returned ${res.status}`);
      return;
    }

    const data = (await res.json()) as { data?: Array<{ title?: string; started_at: string }> };
    const stream = data.data?.[0];
    const status = getOrCreate(channelName);
    const wasLive = status.live;

    if (stream) {
      status.live = true;
      status.streamTitle = stream.title ?? "";
      status.streamStartedAt = new Date(stream.started_at);
      status.wentOfflineAt = null;

      if (!wasLive && eventBus) {
        await eventBus.publish("stream:online", {
          channelId: channelName,
          username: channelName,
          title: status.streamTitle,
          startedAt: stream.started_at,
        });
      }
    } else {
      if (wasLive) {
        status.wentOfflineAt = new Date();
        if (eventBus) {
          await eventBus.publish("stream:offline", {
            channelId: channelName,
            username: channelName,
          });
        }
      }
      status.live = false;
      status.streamTitle = "";
      status.streamStartedAt = null;
    }
  } catch (err) {
    consola.warn(`[StreamStatus] Poll error for ${channelName}: ${err}`);
  }
}

export function isLive(channel?: string): boolean {
  if (!channel) {
    // Backward compat: return true if any channel is live
    for (const status of channelStatuses.values()) {
      if (status.live) return true;
    }
    return false;
  }
  return channelStatuses.get(channel)?.live ?? false;
}

export function getTitle(channel?: string): string {
  if (!channel) {
    for (const status of channelStatuses.values()) {
      if (status.live) return status.streamTitle;
    }
    return "";
  }
  return channelStatuses.get(channel)?.streamTitle ?? "";
}

export function getStreamStartedAt(channel?: string): Date | null {
  if (!channel) {
    for (const status of channelStatuses.values()) {
      if (status.live) return status.streamStartedAt;
    }
    return null;
  }
  return channelStatuses.get(channel)?.streamStartedAt ?? null;
}

export function getWentOfflineAt(channel?: string): Date | null {
  if (!channel) {
    for (const status of channelStatuses.values()) {
      if (status.wentOfflineAt) return status.wentOfflineAt;
    }
    return null;
  }
  return channelStatuses.get(channel)?.wentOfflineAt ?? null;
}

export async function start(
  channels: string[],
  clientId: string,
  getAccessToken: () => Promise<string>,
  eventBus?: EventBus
): Promise<void> {
  // Initial fetch for all channels
  for (const channel of channels) {
    await poll(channel, clientId, getAccessToken, eventBus);
  }

  // Poll every 60 seconds
  cron.schedule("* * * * *", () => {
    for (const channel of channels) {
      poll(channel, clientId, getAccessToken, eventBus);
    }
  });

  const statuses = channels.map(
    (ch) => `${ch}: ${isLive(ch) ? "LIVE" : "OFFLINE"}`
  );
  consola.info(`[StreamStatus] Polling started for ${channels.length} channel(s) (${statuses.join(", ")})`);
}

export function addChannel(
  channel: string,
  clientId: string,
  getAccessToken: () => Promise<string>,
  eventBus?: EventBus
): void {
  if (!channelStatuses.has(channel)) {
    poll(channel, clientId, getAccessToken, eventBus);
  }
}

export function removeChannel(channel: string): void {
  channelStatuses.delete(channel);
}
