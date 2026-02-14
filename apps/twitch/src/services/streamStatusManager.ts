import cron from "node-cron";
import consola from "consola";

const HELIX_STREAMS_URL = "https://api.twitch.tv/helix/streams";

let live = false;
let streamTitle = "";
let streamStartedAt: Date | null = null;
let wentOfflineAt: Date | null = null;

async function poll(
  channelName: string,
  clientId: string,
  getAccessToken: () => Promise<string>
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
      consola.warn({
        message: `[StreamStatus] Helix API returned ${res.status}`,
        badge: true,
        timestamp: new Date(),
      });
      return;
    }

    const data = (await res.json()) as { data?: Array<{ title?: string; started_at: string }> };
    const stream = data.data?.[0];

    if (stream) {
      live = true;
      streamTitle = stream.title ?? "";
      streamStartedAt = new Date(stream.started_at);
      wentOfflineAt = null;
    } else {
      if (live) {
        wentOfflineAt = new Date();
      }
      live = false;
      streamTitle = "";
      streamStartedAt = null;
    }
  } catch (err) {
    consola.warn({
      message: `[StreamStatus] Poll error: ${err}`,
      badge: true,
      timestamp: new Date(),
    });
  }
}

export function isLive(): boolean {
  return live;
}

export function getTitle(): string {
  return streamTitle;
}

export function getStreamStartedAt(): Date | null {
  return streamStartedAt;
}

export function getWentOfflineAt(): Date | null {
  return wentOfflineAt;
}

export async function start(
  channelName: string,
  clientId: string,
  getAccessToken: () => Promise<string>
): Promise<void> {
  // Initial fetch
  await poll(channelName, clientId, getAccessToken);

  // Poll every 60 seconds
  cron.schedule("* * * * *", () => {
    poll(channelName, clientId, getAccessToken);
  });

  consola.info({
    message: `[StreamStatus] Polling started for ${channelName} (currently ${live ? "LIVE" : "OFFLINE"})`,
    badge: true,
    timestamp: new Date(),
  });
}
