/**
 * Tracks active chatters per channel for ${random.chatter} variable support.
 */

const channels = new Map<string, Set<string>>();

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

export function trackMessage(channel: string, user: string): void {
  trackJoin(channel, user);
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
