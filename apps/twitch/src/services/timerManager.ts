/**
 * Timer Manager — Schedules recurring chat messages per channel.
 *
 * Timers fire at configured intervals. Enhanced timers support:
 * - Separate online/offline intervals
 * - enabledWhenOnline / enabledWhenOffline flags
 * - Game filter (only fire when current game matches)
 * - Title keywords (only fire when stream title contains keyword)
 * - chatLines threshold
 *
 * When stream status changes, timers are restarted with the appropriate interval.
 */
import type { ChatClient } from "@twurple/chat";

import { db, eq, and } from "@community-bot/db";
import { botChannels, twitchTimers } from "@community-bot/db";
import { isLive, getGame, getTitle } from "./streamStatusManager.js";
import { getMessageCount, resetMessageCount } from "./chatterTracker.js";
import { substituteVariables } from "./commandExecutor.js";
import { logger } from "../utils/logger.js";

interface ActiveTimer {
  id: string;
  name: string;
  message: string;
  intervalMinutes: number;
  chatLines: number;
  onlineIntervalSeconds: number;
  offlineIntervalSeconds: number | null;
  enabledWhenOnline: boolean;
  enabledWhenOffline: boolean;
  gameFilter: string[];
  titleKeywords: string[];
  intervalHandle: ReturnType<typeof setInterval>;
}

// channel username (lowercase, no #) → active timers
const channelTimers = new Map<string, ActiveTimer[]>();

let chatClientRef: ChatClient | null = null;

export function setChatClient(client: ChatClient): void {
  chatClientRef = client;
}

function normalize(channel: string): string {
  return channel.replace(/^#/, "").toLowerCase();
}

async function fireTimer(channel: string, timer: ActiveTimer): Promise<void> {
  const channelKey = normalize(channel);
  const live = isLive(channelKey);

  // Check enabled-when-online / enabled-when-offline guards
  if (live && !timer.enabledWhenOnline) return;
  if (!live && !timer.enabledWhenOffline) return;

  // Game filter (only when live; skip filter when offline)
  if (live && timer.gameFilter.length > 0) {
    const currentGame = (getGame(channelKey) ?? "").toLowerCase();
    const matches = timer.gameFilter.some((g) =>
      currentGame.includes(g.toLowerCase())
    );
    if (!matches) return;
  }

  // Title keywords filter (only when live)
  if (live && timer.titleKeywords.length > 0) {
    const title = (getTitle(channelKey) ?? "").toLowerCase();
    const matches = timer.titleKeywords.some((kw) =>
      title.includes(kw.toLowerCase())
    );
    if (!matches) return;
  }

  // Check chat line threshold
  if (timer.chatLines > 0) {
    const count = getMessageCount(channelKey);
    if (count < timer.chatLines) return;
  }

  if (!chatClientRef) return;

  try {
    if (timer.chatLines > 0) {
      resetMessageCount(channelKey);
    }

    let message = timer.message;
    try {
      message = await substituteVariables(timer.message, {
        user: "",
        channel: `#${channelKey}`,
        args: [],
        msg: { userInfo: { userId: "", displayName: "", isMod: false, isBroadcaster: false, isVip: false, isSubscriber: false } } as any,
      });
    } catch {
      // Fall back to raw message if substitution fails
    }

    await chatClientRef.say(`#${channelKey}`, message);
    logger.debug("TimerManager", `Timer "${timer.name}" fired in ${channelKey}`);
  } catch (err) {
    logger.warn(
      "TimerManager",
      `Error firing timer "${timer.name}" in ${channelKey}`,
      err instanceof Error ? { error: err.message } : undefined
    );
  }
}

function getIntervalMs(timer: Omit<ActiveTimer, "intervalHandle">): number {
  const live = isLive(timer.id); // id here is channel key; we'll pass channel separately
  // Fallback: if offlineIntervalSeconds not set, use onlineIntervalSeconds
  if (!live && timer.offlineIntervalSeconds != null) {
    return timer.offlineIntervalSeconds * 1000;
  }
  return timer.onlineIntervalSeconds * 1000;
}

export async function loadTimers(channel: string): Promise<void> {
  const channelKey = normalize(channel);

  stopTimers(channelKey);

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.twitchUsername, channelKey),
    columns: { id: true },
  });

  if (!botChannel) return;

  const timers = await db.query.twitchTimers.findMany({
    where: and(
      eq(twitchTimers.botChannelId, botChannel.id),
      eq(twitchTimers.enabled, true)
    ),
  });

  if (timers.length === 0) return;

  const activeTimers: ActiveTimer[] = [];

  for (const timer of timers) {
    const live = isLive(channelKey);
    let intervalMs: number;
    if (!live && timer.offlineIntervalSeconds != null) {
      intervalMs = timer.offlineIntervalSeconds * 1000;
    } else {
      intervalMs = timer.onlineIntervalSeconds * 1000;
    }

    const timerData: Omit<ActiveTimer, "intervalHandle"> = {
      id: timer.id,
      name: timer.name,
      message: timer.message,
      intervalMinutes: timer.intervalMinutes,
      chatLines: timer.chatLines,
      onlineIntervalSeconds: timer.onlineIntervalSeconds,
      offlineIntervalSeconds: timer.offlineIntervalSeconds ?? null,
      enabledWhenOnline: timer.enabledWhenOnline,
      enabledWhenOffline: timer.enabledWhenOffline,
      gameFilter: timer.gameFilter,
      titleKeywords: timer.titleKeywords,
    };

    const handle = setInterval(() => {
      fireTimer(channelKey, { ...timerData, intervalHandle: handle });
    }, intervalMs);

    activeTimers.push({ ...timerData, intervalHandle: handle });
  }

  channelTimers.set(channelKey, activeTimers);
  logger.info(
    "TimerManager",
    `Loaded ${activeTimers.length} timer(s) for ${channelKey}`
  );
}

/**
 * Called when stream status changes — restart timers with new interval.
 * This allows seamless switching between online/offline intervals.
 */
export async function onStreamStatusChange(channel: string): Promise<void> {
  await loadTimers(channel);
}

export async function reloadTimers(channel: string): Promise<void> {
  await loadTimers(channel);
}

export function stopTimers(channel: string): void {
  const channelKey = normalize(channel);
  const timers = channelTimers.get(channelKey);
  if (timers) {
    for (const timer of timers) {
      clearInterval(timer.intervalHandle);
    }
    channelTimers.delete(channelKey);
  }
}

export function stopAll(): void {
  for (const [channel] of channelTimers) {
    stopTimers(channel);
  }
}

/** Returns the number of active timers for a channel (for testing). */
export function getActiveTimerCount(channel: string): number {
  return channelTimers.get(normalize(channel))?.length ?? 0;
}
