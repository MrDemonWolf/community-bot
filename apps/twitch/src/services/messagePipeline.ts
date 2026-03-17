/**
 * Message Pipeline — Pure evaluation of message handling without side effects.
 *
 * `evaluateMessage()` is the extracted core of the message handler. It can be
 * called by the live handler (then side effects are dispatched separately) or
 * by the config tester API route with mock context. No chat messages are sent,
 * no DB writes occur, no cooldowns are recorded.
 */
import type { SpamFilterConfig } from "./spamFilter.js";
import type { CachedKeyword } from "./keywordCache.js";
import type { CachedCommand } from "./commandCache.js";
import {
  checkCaps,
  checkLinks,
  checkSymbols,
  checkEmotes,
  checkRepetition,
  checkBannedWords,
} from "./spamFilter.js";
import { substituteVariables } from "./commandExecutor.js";

export interface PipelineInput {
  text: string;
  username: string;
  userId: string;
  /** Simulated access level for tester */
  accessLevel: string;
  /** Whether the stream is live */
  isLive: boolean;
  /** Spam filter config for the channel */
  spamConfig: SpamFilterConfig | null;
  /** Active keywords sorted by priority */
  keywords: CachedKeyword[];
  /** Built-in command names for the channel */
  builtInCommandNames: string[];
  /** DB commands (prefix + regex) */
  dbCommands: Array<{
    id: string;
    name: string;
    aliases: string[];
    regex: string | null;
    response: string;
    responseType: string;
    accessLevel: string;
    streamStatus: string;
    globalCooldown: number;
    userCooldown: number;
  }>;
  /** Optional: current game/title for filter checks */
  currentGame?: string;
  currentTitle?: string;
  /** dryRun: skip side-effectful variable substitutions (customapi, count) */
  dryRun?: boolean;
}

export interface SpamCheckResult {
  triggered: boolean;
  type?: "caps" | "links" | "symbols" | "emotes" | "repetition" | "bannedWords";
  value?: string;
}

export interface PipelineResult {
  spamCheck: SpamCheckResult;
  matchedKeyword: CachedKeyword | null;
  matchedBuiltIn: string | null;
  matchedDbCommand: PipelineInput["dbCommands"][number] | null;
  responsePreview: string | null;
  stopReason: string | null;
}

function accessLevelRank(level: string): number {
  const ranks: Record<string, number> = {
    EVERYONE: 0,
    SUBSCRIBER: 1,
    REGULAR: 2,
    VIP: 3,
    MODERATOR: 4,
    LEAD_MODERATOR: 5,
    BROADCASTER: 6,
  };
  return ranks[level] ?? 0;
}

function meetsLevel(userLevel: string, required: string): boolean {
  return accessLevelRank(userLevel) >= accessLevelRank(required);
}

function phraseMatches(phrase: string, text: string, defaultCaseSensitive: boolean): boolean {
  let remaining = phrase;
  let negative = false;
  let caseSensitive = defaultCaseSensitive;
  let useRegex = false;

  let changed = true;
  while (changed) {
    changed = false;
    if (remaining.startsWith("negative:")) { negative = !negative; remaining = remaining.slice(9); changed = true; }
    if (remaining.startsWith("sensitive:")) { caseSensitive = true; remaining = remaining.slice(10); changed = true; }
    if (remaining.startsWith("regex:")) { useRegex = true; remaining = remaining.slice(6); changed = true; }
  }

  let matched: boolean;
  if (useRegex) {
    try {
      matched = new RegExp(remaining, caseSensitive ? "" : "i").test(text);
    } catch { matched = false; }
  } else {
    const h = caseSensitive ? text : text.toLowerCase();
    const n = caseSensitive ? remaining : remaining.toLowerCase();
    matched = h.includes(n);
  }
  return negative ? !matched : matched;
}

export async function evaluateMessage(input: PipelineInput): Promise<PipelineResult> {
  const result: PipelineResult = {
    spamCheck: { triggered: false },
    matchedKeyword: null,
    matchedBuiltIn: null,
    matchedDbCommand: null,
    responsePreview: null,
    stopReason: null,
  };

  const { text, username, accessLevel, isLive, spamConfig, dryRun = false } = input;

  // ── Spam filter check ──────────────────────────────────────────────
  if (spamConfig) {
    const {
      capsEnabled, capsMinLength, capsMaxPercent,
      linksEnabled,
      symbolsEnabled, symbolsMaxPercent,
      emotesEnabled, emotesMaxCount,
      repetitionEnabled, repetitionMaxRepeat,
      bannedWordsEnabled, bannedWords,
    } = spamConfig;

    if (capsEnabled && checkCaps(text, capsMinLength, capsMaxPercent)) {
      result.spamCheck = { triggered: true, type: "caps" };
    } else if (linksEnabled && checkLinks(text)) {
      result.spamCheck = { triggered: true, type: "links" };
    } else if (symbolsEnabled && checkSymbols(text, symbolsMaxPercent)) {
      result.spamCheck = { triggered: true, type: "symbols" };
    } else if (emotesEnabled && checkEmotes(text, emotesMaxCount)) {
      result.spamCheck = { triggered: true, type: "emotes" };
    } else if (repetitionEnabled && checkRepetition(text, repetitionMaxRepeat)) {
      result.spamCheck = { triggered: true, type: "repetition" };
    } else if (bannedWordsEnabled && bannedWords.length > 0) {
      const hit = checkBannedWords(text, bannedWords);
      if (hit) result.spamCheck = { triggered: true, type: "bannedWords", value: hit };
    }
  }

  // ── Keyword check ──────────────────────────────────────────────────
  for (const kw of input.keywords) {
    if (!kw.enabled) continue;
    if (!meetsLevel(accessLevel, kw.accessLevel)) continue;
    const kwOk =
      kw.streamStatus === "BOTH" ||
      (kw.streamStatus === "ONLINE" && isLive) ||
      (kw.streamStatus === "OFFLINE" && !isLive);
    if (!kwOk) continue;

    const groupMatched = kw.phraseGroups.some((group) =>
      group.length > 0 && group.every((p) => phraseMatches(p, text, kw.caseSensitive))
    );

    if (groupMatched) {
      result.matchedKeyword = kw;
      result.responsePreview = dryRun ? kw.response : kw.response;
      if (kw.stopProcessing) {
        result.stopReason = "keyword:stopProcessing";
        return result;
      }
      break;
    }
  }

  // ── Phase 1: Built-in prefix commands ─────────────────────────────
  if (text.startsWith("!")) {
    const args = text.slice(1).trim().split(/\s+/);
    const cmdName = args[0]?.toLowerCase();
    if (cmdName && input.builtInCommandNames.includes(cmdName)) {
      result.matchedBuiltIn = cmdName;
      result.responsePreview = `[built-in: !${cmdName}]`;
      return result;
    }

    // ── Phase 2: DB prefix commands ──────────────────────────────────
    const dbCmd = input.dbCommands.find(
      (c) =>
        !c.regex &&
        (c.name === cmdName || c.aliases.includes(cmdName ?? ""))
    );
    if (dbCmd) {
      if (meetsLevel(accessLevel, dbCmd.accessLevel)) {
        const cmdOk =
          dbCmd.streamStatus === "BOTH" ||
          (dbCmd.streamStatus === "ONLINE" && isLive) ||
          (dbCmd.streamStatus === "OFFLINE" && !isLive);
        if (cmdOk) {
          result.matchedDbCommand = dbCmd;
          result.responsePreview = dryRun
            ? dbCmd.response
            : await safeSubstitute(dbCmd.response, username);
          return result;
        }
      }
      result.stopReason = "db_prefix:access_or_status";
      return result;
    }
  }

  // ── Phase 3: DB regex commands ─────────────────────────────────────
  for (const cmd of input.dbCommands.filter((c) => c.regex)) {
    try {
      if (!new RegExp(cmd.regex!).test(text)) continue;
    } catch { continue; }

    if (!meetsLevel(accessLevel, cmd.accessLevel)) continue;
    const cmdOk =
      cmd.streamStatus === "BOTH" ||
      (cmd.streamStatus === "ONLINE" && isLive) ||
      (cmd.streamStatus === "OFFLINE" && !isLive);
    if (!cmdOk) continue;

    result.matchedDbCommand = cmd;
    result.responsePreview = dryRun
      ? cmd.response
      : await safeSubstitute(cmd.response, username);
    return result;
  }

  return result;
}

async function safeSubstitute(template: string, user: string): Promise<string> {
  try {
    return await substituteVariables(template, {
      user,
      channel: "#unknown",
      args: [],
      msg: { userInfo: { userId: "", displayName: user, isMod: false, isBroadcaster: false, isVip: false, isSubscriber: false } } as any,
    });
  } catch {
    return template;
  }
}
