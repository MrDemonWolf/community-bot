/**
 * Spam Filter Service — Configurable spam protection per channel.
 *
 * Checks messages against enabled filters (caps, links, symbols, emotes,
 * repetition, banned words). Users at or above the exempt level, mods,
 * broadcasters, and users with active permits are skipped.
 */
import type { ChatClient } from "@twurple/chat";
import type { ChatMessage } from "@twurple/chat";

import { prisma } from "@community-bot/db";
import { TwitchAccessLevel } from "@community-bot/db";
import { getUserAccessLevel, meetsAccessLevel } from "./accessControl.js";
import { logger } from "../utils/logger.js";

interface SpamFilterConfig {
  capsEnabled: boolean;
  capsMinLength: number;
  capsMaxPercent: number;
  linksEnabled: boolean;
  linksAllowSubs: boolean;
  symbolsEnabled: boolean;
  symbolsMaxPercent: number;
  emotesEnabled: boolean;
  emotesMaxCount: number;
  repetitionEnabled: boolean;
  repetitionMaxRepeat: number;
  bannedWordsEnabled: boolean;
  bannedWords: string[];
  exemptLevel: TwitchAccessLevel;
  timeoutDuration: number;
  warningMessage: string;
}

// channel username (lowercase, no #) → filter config
const filterConfigs = new Map<string, SpamFilterConfig>();

function normalize(channel: string): string {
  return channel.replace(/^#/, "").toLowerCase();
}

export async function loadSpamFilter(channel: string): Promise<void> {
  const channelKey = normalize(channel);

  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: channelKey },
    select: { id: true },
  });

  if (!botChannel) return;

  const filter = await prisma.spamFilter.findUnique({
    where: { botChannelId: botChannel.id },
  });

  if (!filter) {
    filterConfigs.delete(channelKey);
    return;
  }

  filterConfigs.set(channelKey, {
    capsEnabled: filter.capsEnabled,
    capsMinLength: filter.capsMinLength,
    capsMaxPercent: filter.capsMaxPercent,
    linksEnabled: filter.linksEnabled,
    linksAllowSubs: filter.linksAllowSubs,
    symbolsEnabled: filter.symbolsEnabled,
    symbolsMaxPercent: filter.symbolsMaxPercent,
    emotesEnabled: filter.emotesEnabled,
    emotesMaxCount: filter.emotesMaxCount,
    repetitionEnabled: filter.repetitionEnabled,
    repetitionMaxRepeat: filter.repetitionMaxRepeat,
    bannedWordsEnabled: filter.bannedWordsEnabled,
    bannedWords: filter.bannedWords,
    exemptLevel: filter.exemptLevel as TwitchAccessLevel,
    timeoutDuration: filter.timeoutDuration,
    warningMessage: filter.warningMessage,
  });

  logger.info("SpamFilter", `Loaded spam filter config for ${channelKey}`);
}

export async function reloadSpamFilter(channel: string): Promise<void> {
  await loadSpamFilter(channel);
}

export function getFilterConfig(channel: string): SpamFilterConfig | undefined {
  return filterConfigs.get(normalize(channel));
}

/** Check if user has an active spam permit. */
async function hasActivePermit(username: string, channel: string): Promise<boolean> {
  const channelKey = normalize(channel);
  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: channelKey },
    select: { id: true },
  });
  if (!botChannel) return false;

  const permit = await prisma.spamPermit.findFirst({
    where: {
      username: username.toLowerCase(),
      botChannelId: botChannel.id,
      expiresAt: { gt: new Date() },
    },
  });

  return !!permit;
}

// --- Individual filter checks ---

export function checkCaps(text: string, minLength: number, maxPercent: number): boolean {
  if (text.length < minLength) return false;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return (upper / letters.length) * 100 > maxPercent;
}

const URL_REGEX = /(?:https?:\/\/|www\.)\S+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?/i;

export function checkLinks(text: string): boolean {
  return URL_REGEX.test(text);
}

export function checkSymbols(text: string, maxPercent: number): boolean {
  if (text.length === 0) return false;
  const symbols = text.replace(/[a-zA-Z0-9\s]/g, "").length;
  return (symbols / text.length) * 100 > maxPercent;
}

export function checkEmotes(text: string, maxCount: number): boolean {
  // Count words that look like emote codes (camelCase or all-caps short words)
  // This is a simple heuristic; Twitch emotes are hard to detect without the emote API
  const words = text.split(/\s+/);
  return words.length > maxCount;
}

export function checkRepetition(text: string, maxRepeat: number): boolean {
  // Check for repeated characters (e.g., "aaaaaaa")
  const charRepeat = /(.)\1+/g;
  let match;
  while ((match = charRepeat.exec(text)) !== null) {
    if (match[0].length >= maxRepeat) return true;
  }

  // Check for repeated words (e.g., "spam spam spam spam")
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    const count = (wordCounts.get(word) ?? 0) + 1;
    wordCounts.set(word, count);
    if (count >= maxRepeat) return true;
  }

  return false;
}

export function checkBannedWords(text: string, bannedWords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const word of bannedWords) {
    if (lower.includes(word.toLowerCase())) {
      return word;
    }
  }
  return null;
}

export type FilterViolation = "banned_words" | "links" | "caps" | "symbols" | "emotes" | "repetition";

/**
 * Check a message against all enabled spam filters.
 * Returns the violation type if triggered, or null if clean.
 */
export async function checkMessage(
  channel: string,
  user: string,
  text: string,
  msg: ChatMessage
): Promise<FilterViolation | null> {
  const channelKey = normalize(channel);
  const config = filterConfigs.get(channelKey);
  if (!config) return null;

  // Mods and broadcasters are always exempt
  const userLevel = getUserAccessLevel(msg);
  if (
    userLevel === TwitchAccessLevel.MODERATOR ||
    userLevel === TwitchAccessLevel.LEAD_MODERATOR ||
    userLevel === TwitchAccessLevel.BROADCASTER
  ) {
    return null;
  }

  // Check exempt level
  if (meetsAccessLevel(userLevel, config.exemptLevel)) {
    return null;
  }

  // Check active permit
  if (await hasActivePermit(user, channel)) {
    return null;
  }

  // Check filters in order: banned words → links → caps → symbols → emotes → repetition
  if (config.bannedWordsEnabled && checkBannedWords(text, config.bannedWords)) {
    return "banned_words";
  }

  if (config.linksEnabled) {
    // If linksAllowSubs is true and user is a subscriber, skip
    const skipLinks = config.linksAllowSubs && meetsAccessLevel(userLevel, TwitchAccessLevel.SUBSCRIBER);
    if (!skipLinks && checkLinks(text)) {
      return "links";
    }
  }

  if (config.capsEnabled && checkCaps(text, config.capsMinLength, config.capsMaxPercent)) {
    return "caps";
  }

  if (config.symbolsEnabled && checkSymbols(text, config.symbolsMaxPercent)) {
    return "symbols";
  }

  if (config.emotesEnabled && checkEmotes(text, config.emotesMaxCount)) {
    return "emotes";
  }

  if (config.repetitionEnabled && checkRepetition(text, config.repetitionMaxRepeat)) {
    return "repetition";
  }

  return null;
}

/**
 * Handle a spam filter violation: timeout the user and post a warning.
 */
export async function handleViolation(
  chatClient: ChatClient,
  channel: string,
  user: string,
  violation: FilterViolation
): Promise<void> {
  const channelKey = normalize(channel);
  const config = filterConfigs.get(channelKey);
  if (!config) return;

  try {
    await chatClient.say(
      `#${channelKey}`,
      `/timeout ${user} ${config.timeoutDuration} Spam filter: ${violation}`
    );
    await chatClient.say(`#${channelKey}`, `@${user} ${config.warningMessage}`);
    logger.debug(
      "SpamFilter",
      `${violation} violation by ${user} in ${channelKey} — timed out for ${config.timeoutDuration}s`
    );
  } catch (err) {
    logger.warn(
      "SpamFilter",
      `Failed to timeout ${user} in ${channelKey}`,
      err instanceof Error ? { error: err.message } : undefined
    );
  }
}
