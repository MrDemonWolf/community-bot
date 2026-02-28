/**
 * Tracks active chatters per channel for ${random.chatter} variable support,
 * per-channel message counts for timer chat-line thresholds, and a rolling
 * message buffer for moderation commands like !nuke.
 */

const channels = new Map<string, Set<string>>();
const messageCounters = new Map<string, number>();

export interface BufferedMessage {
  username: string;
  text: string;
  timestamp: number;
}

const MAX_BUFFER_SIZE = 100;
const messageBuffers = new Map<string, BufferedMessage[]>();

function normalize(channel: string): string {
  return channel.replace(/^#/, "").toLowerCase();
}

export function trackJoin(channel: string, user: string): void {
  const key = normalize(channel);
  if (!channels.has(key)) {
    channels.set(key, new Set());
  }
  channels.get(key)!.add(user.toLowerCase());
}

export function trackPart(channel: string, user: string): void {
  const key = normalize(channel);
  channels.get(key)?.delete(user.toLowerCase());
}

export function trackMessage(channel: string, user: string, text?: string): void {
  trackJoin(channel, user);
  const key = normalize(channel);
  messageCounters.set(key, (messageCounters.get(key) ?? 0) + 1);

  // Add to rolling message buffer if text provided
  if (text !== undefined) {
    if (!messageBuffers.has(key)) {
      messageBuffers.set(key, []);
    }
    const buffer = messageBuffers.get(key)!;
    buffer.push({ username: user.toLowerCase(), text, timestamp: Date.now() });
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }
  }
}

export function getChattersCount(channel: string): number {
  const key = normalize(channel);
  return channels.get(key)?.size ?? 0;
}

export function getRandomChatter(channel: string): string | null {
  const key = normalize(channel);
  const chatters = channels.get(key);
  if (!chatters || chatters.size === 0) return null;
  const arr = Array.from(chatters);
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Returns the total message count for a channel since last reset. */
export function getMessageCount(channel: string): number {
  const key = normalize(channel);
  return messageCounters.get(key) ?? 0;
}

/** Resets the message count for a channel (called when a timer fires). */
export function resetMessageCount(channel: string): void {
  const key = normalize(channel);
  messageCounters.set(key, 0);
}

/** Returns the rolling message buffer for a channel (for !nuke). */
export function getRecentMessages(channel: string): BufferedMessage[] {
  const key = normalize(channel);
  return messageBuffers.get(key) ?? [];
}
