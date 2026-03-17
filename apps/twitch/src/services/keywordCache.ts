/**
 * Keyword Cache — Caches keyword auto-response configs per channel.
 *
 * Phrase group format (phraseGroups: string[][]):
 *   Outer array = OR groups. At least one group must match.
 *   Inner array = AND phrases. All phrases in the group must match.
 *
 * Phrase prefix flags (applied at runtime):
 *   "regex:"     — treat phrase as regex
 *   "sensitive:" — case-sensitive match for this phrase
 *   "negative:"  — phrase must NOT match (can chain: "negative:regex:...")
 */
import { db, eq } from "@community-bot/db";
import { botChannels, keywords as keywordsTable } from "@community-bot/db";
import { logger } from "../utils/logger.js";

export interface CachedKeyword {
  id: string;
  name: string;
  enabled: boolean;
  phraseGroups: string[][];
  response: string;
  responseType: "SAY" | "MENTION" | "REPLY";
  accessLevel: string;
  globalCooldown: number;
  userCooldown: number;
  streamStatus: "ONLINE" | "OFFLINE" | "BOTH";
  priority: number;
  stopProcessing: boolean;
  caseSensitive: boolean;
}

// channel username (lowercase, no #) → sorted keywords
const cache = new Map<string, CachedKeyword[]>();

function normalize(channel: string): string {
  return channel.replace(/^#/, "").toLowerCase();
}

export async function loadKeywords(channel: string): Promise<void> {
  const channelKey = normalize(channel);

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.twitchUsername, channelKey),
    columns: { id: true },
  });

  if (!botChannel) {
    cache.delete(channelKey);
    return;
  }

  const rows = await db.query.keywords.findMany({
    where: eq(keywordsTable.botChannelId, botChannel.id),
    orderBy: (kw, { asc, desc }) => [desc(kw.priority), asc(kw.name)],
  });

  const active = rows
    .filter((k) => k.enabled)
    .map((k) => ({
      id: k.id,
      name: k.name,
      enabled: k.enabled,
      phraseGroups: (k.phraseGroups as string[][]) ?? [],
      response: k.response,
      responseType: k.responseType as "SAY" | "MENTION" | "REPLY",
      accessLevel: k.accessLevel,
      globalCooldown: k.globalCooldown,
      userCooldown: k.userCooldown,
      streamStatus: k.streamStatus as "ONLINE" | "OFFLINE" | "BOTH",
      priority: k.priority,
      stopProcessing: k.stopProcessing,
      caseSensitive: k.caseSensitive,
    }));

  cache.set(channelKey, active);
  logger.debug("KeywordCache", `Loaded ${active.length} keyword(s) for ${channelKey}`);
}

export async function reloadKeywords(channel: string): Promise<void> {
  await loadKeywords(channel);
}

export function clearKeywords(channel: string): void {
  cache.delete(normalize(channel));
}

/**
 * Evaluates a single phrase against a message text, respecting prefix flags.
 */
function matchPhrase(phrase: string, text: string, defaultCaseSensitive: boolean): boolean {
  let remaining = phrase;
  let negative = false;
  let caseSensitive = defaultCaseSensitive;
  let useRegex = false;

  // Parse prefix flags (chainable)
  let changed = true;
  while (changed) {
    changed = false;
    if (remaining.startsWith("negative:")) {
      negative = !negative;
      remaining = remaining.slice("negative:".length);
      changed = true;
    }
    if (remaining.startsWith("sensitive:")) {
      caseSensitive = true;
      remaining = remaining.slice("sensitive:".length);
      changed = true;
    }
    if (remaining.startsWith("regex:")) {
      useRegex = true;
      remaining = remaining.slice("regex:".length);
      changed = true;
    }
  }

  let matched: boolean;
  if (useRegex) {
    try {
      const flags = caseSensitive ? "" : "i";
      matched = new RegExp(remaining, flags).test(text);
    } catch {
      matched = false;
    }
  } else {
    const haystack = caseSensitive ? text : text.toLowerCase();
    const needle = caseSensitive ? remaining : remaining.toLowerCase();
    matched = haystack.includes(needle);
  }

  return negative ? !matched : matched;
}

/**
 * Returns the first keyword that matches the message text, or null.
 */
export function matchKeywords(channel: string, text: string): CachedKeyword | null {
  const channelKey = normalize(channel);
  const kws = cache.get(channelKey);
  if (!kws || kws.length === 0) return null;

  for (const kw of kws) {
    if (kw.phraseGroups.length === 0) continue;

    // OR over groups: any one group matching is sufficient
    const groupMatched = kw.phraseGroups.some((group) => {
      if (group.length === 0) return false;
      // AND over phrases in group: all must match
      return group.every((phrase) =>
        matchPhrase(phrase, text, kw.caseSensitive)
      );
    });

    if (groupMatched) return kw;
  }

  return null;
}

export function getKeywords(channel: string): CachedKeyword[] {
  return cache.get(normalize(channel)) ?? [];
}
