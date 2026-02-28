/**
 * Timer Manager — Schedules recurring chat messages per channel.
 *
 * Timers fire at configured intervals and only post when:
 * 1. The timer is enabled
 * 2. The channel is live (via streamStatusManager)
 * 3. The chatLines threshold has been met since the last fire
 *
 * Variable substitution is supported in timer messages (reuses commandExecutor).
 */
import type { ChatClient } from "@twurple/chat";

import { prisma } from "@community-bot/db";
import { isLive } from "./streamStatusManager.js";
import { getMessageCount, resetMessageCount } from "./chatterTracker.js";
import { substituteVariables } from "./commandExecutor.js";
import { logger } from "../utils/logger.js";

interface ActiveTimer {
  id: string;
  name: string;
  message: string;
  intervalMinutes: number;
  chatLines: number;
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

  // Only fire when stream is live
  if (!isLive(channelKey)) return;

  // Check chat line threshold
  if (timer.chatLines > 0) {
    const count = getMessageCount(channelKey);
    if (count < timer.chatLines) return;
  }

  if (!chatClientRef) return;

  try {
    // Reset message counter for this channel when the timer fires
    if (timer.chatLines > 0) {
      resetMessageCount(channelKey);
    }

    let message = timer.message;
    try {
      message = await substituteVariables(timer.message, {
        user: "",
        channel: `#${channelKey}`,
        args: [],
        msg: null as any,
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

export async function loadTimers(channel: string): Promise<void> {
  const channelKey = normalize(channel);

  // Stop any existing timers for this channel
  stopTimers(channelKey);

  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: channelKey },
    select: { id: true },
  });

  if (!botChannel) return;

  const timers = await prisma.twitchTimer.findMany({
    where: { botChannelId: botChannel.id, enabled: true },
  });

  if (timers.length === 0) return;

  const activeTimers: ActiveTimer[] = [];

  for (const timer of timers) {
    const intervalMs = timer.intervalMinutes * 60 * 1000;

    const handle = setInterval(() => {
      fireTimer(channelKey, {
        id: timer.id,
        name: timer.name,
        message: timer.message,
        intervalMinutes: timer.intervalMinutes,
        chatLines: timer.chatLines,
        intervalHandle: handle,
      });
    }, intervalMs);

    activeTimers.push({
      id: timer.id,
      name: timer.name,
      message: timer.message,
      intervalMinutes: timer.intervalMinutes,
      chatLines: timer.chatLines,
      intervalHandle: handle,
    });
  }

  channelTimers.set(channelKey, activeTimers);
  logger.info(
    "TimerManager",
    `Loaded ${activeTimers.length} timer(s) for ${channelKey}`
  );
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
