/**
 * Config Tester — Simulate message handling without side effects.
 *
 * Queries channel config from DB and evaluates what would happen to a given
 * message: spam filter result, matched keyword, matched command, response preview.
 */
import { db, eq, and, spamFilters, keywords, twitchChatCommands } from "@community-bot/db";
import { protectedProcedure, router } from "../index";
import { z } from "zod";
import { getUserBotChannel } from "../utils/botChannel";

const accessLevelRank: Record<string, number> = {
  EVERYONE: 0,
  SUBSCRIBER: 1,
  REGULAR: 2,
  VIP: 3,
  MODERATOR: 4,
  LEAD_MODERATOR: 5,
  BROADCASTER: 6,
};

function meetsLevel(user: string, required: string): boolean {
  return (accessLevelRank[user] ?? 0) >= (accessLevelRank[required] ?? 0);
}

function checkCaps(text: string, minLength: number, maxPercent: number): boolean {
  if (text.length < minLength) return false;
  const caps = text.split("").filter((c) => c >= "A" && c <= "Z").length;
  return (caps / text.length) * 100 > maxPercent;
}

function checkLinks(text: string): boolean {
  return /https?:\/\/\S+|www\.\S+|\S+\.\S{2,}\/\S*/i.test(text);
}

function checkSymbols(text: string, maxPercent: number): boolean {
  const symbols = text.split("").filter((c) => !/[a-zA-Z0-9\s]/.test(c)).length;
  return text.length > 0 && (symbols / text.length) * 100 > maxPercent;
}

function checkEmotes(text: string, maxCount: number): boolean {
  const words = text.trim().split(/\s+/);
  const possibleEmotes = words.filter((w) => /^[A-Z][a-zA-Z]+\d*$/.test(w) || /^:[a-zA-Z]+:$/.test(w));
  return possibleEmotes.length > maxCount;
}

function checkRepetition(text: string, maxRepeat: number): boolean {
  const match = text.match(/(.{3,})\1+/);
  if (!match) return false;
  const repetitions = Math.floor(text.length / match[1].length);
  return repetitions > maxRepeat;
}

function checkBannedWords(text: string, bannedWords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const word of bannedWords) {
    if (lower.includes(word.toLowerCase())) return word;
  }
  return null;
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
    try { matched = new RegExp(remaining, caseSensitive ? "" : "i").test(text); } catch { matched = false; }
  } else {
    matched = (caseSensitive ? text : text.toLowerCase()).includes(caseSensitive ? remaining : remaining.toLowerCase());
  }
  return negative ? !matched : matched;
}

export const configTesterRouter = router({
  test: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(500),
        username: z.string().min(1).max(100),
        accessLevel: z.enum([
          "EVERYONE",
          "SUBSCRIBER",
          "REGULAR",
          "VIP",
          "MODERATOR",
          "LEAD_MODERATOR",
          "BROADCASTER",
        ]),
        isLive: z.boolean(),
        dryRun: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const { message, username, accessLevel, isLive, dryRun } = input;

      // Load spam filter config
      const spamFilter = await db.query.spamFilters.findFirst({
        where: eq(spamFilters.botChannelId, botChannel.id),
      });

      // Load keywords sorted by priority
      const kws = await db.query.keywords.findMany({
        where: and(
          eq(keywords.botChannelId, botChannel.id),
          eq(keywords.enabled, true)
        ),
        orderBy: (kw, { desc, asc }) => [desc(kw.priority), asc(kw.name)],
      });

      // Load DB commands
      const dbCmds = await db.query.twitchChatCommands.findMany({
        where: and(
          eq(twitchChatCommands.botChannelId, botChannel.id),
          eq(twitchChatCommands.enabled, true)
        ),
      });

      // ── Spam filter evaluation ────────────────────────────────────
      type SpamResult = {
        triggered: boolean;
        type?: string;
        value?: string;
      };

      let spamResult: SpamResult = { triggered: false };

      if (spamFilter) {
        const {
          capsEnabled, capsMinLength, capsMaxPercent,
          linksEnabled,
          symbolsEnabled, symbolsMaxPercent,
          emotesEnabled, emotesMaxCount,
          repetitionEnabled, repetitionMaxRepeat,
          bannedWordsEnabled, bannedWords,
        } = spamFilter;

        if (capsEnabled && checkCaps(message, capsMinLength, capsMaxPercent)) {
          spamResult = { triggered: true, type: "caps" };
        } else if (linksEnabled && checkLinks(message)) {
          spamResult = { triggered: true, type: "links" };
        } else if (symbolsEnabled && checkSymbols(message, symbolsMaxPercent)) {
          spamResult = { triggered: true, type: "symbols" };
        } else if (emotesEnabled && checkEmotes(message, emotesMaxCount)) {
          spamResult = { triggered: true, type: "emotes" };
        } else if (repetitionEnabled && checkRepetition(message, repetitionMaxRepeat)) {
          spamResult = { triggered: true, type: "repetition" };
        } else if (bannedWordsEnabled && bannedWords.length > 0) {
          const hit = checkBannedWords(message, bannedWords);
          if (hit) spamResult = { triggered: true, type: "bannedWords", value: hit };
        }
      }

      // ── Keyword evaluation ────────────────────────────────────────
      type MatchedKeyword = typeof kws[number] | null;
      let matchedKeyword: MatchedKeyword = null;
      let keywordStops = false;

      for (const kw of kws) {
        if (!meetsLevel(accessLevel, kw.accessLevel)) continue;
        const kwStatusOk =
          kw.streamStatus === "BOTH" ||
          (kw.streamStatus === "ONLINE" && isLive) ||
          (kw.streamStatus === "OFFLINE" && !isLive);
        if (!kwStatusOk) continue;

        const phraseGroups = (kw.phraseGroups as string[][]) ?? [];
        const matched = phraseGroups.some((group) =>
          group.length > 0 &&
          group.every((p) => phraseMatches(p, message, kw.caseSensitive))
        );

        if (matched) {
          matchedKeyword = kw;
          keywordStops = kw.stopProcessing;
          break;
        }
      }

      // ── Command evaluation ────────────────────────────────────────
      type MatchedCommand = typeof dbCmds[number] | null;
      let matchedBuiltIn: string | null = null;
      let matchedDbCommand: MatchedCommand = null;
      let responsePreview: string | null = null;

      if (!keywordStops) {
        if (message.startsWith("!")) {
          const args = message.slice(1).trim().split(/\s+/);
          const cmdName = args[0]?.toLowerCase() ?? "";

          // Built-in commands (report by name only — the list is bot-side)
          const BUILT_IN_NAMES = [
            "bot", "sr", "queue", "quote", "counter", "nuke", "vanish",
            "clip", "permit", "shoutout", "so", "game", "title", "uptime",
          ];
          if (BUILT_IN_NAMES.includes(cmdName)) {
            matchedBuiltIn = cmdName;
            responsePreview = `[built-in command: !${cmdName}]`;
          } else {
            // DB prefix / alias match
            const dbCmd = dbCmds.find(
              (c) => !c.regex && (c.name === cmdName || c.aliases.includes(cmdName))
            );
            if (dbCmd) {
              if (meetsLevel(accessLevel, dbCmd.accessLevel)) {
                const statusOk =
                  dbCmd.streamStatus === "BOTH" ||
                  (dbCmd.streamStatus === "ONLINE" && isLive) ||
                  (dbCmd.streamStatus === "OFFLINE" && !isLive);
                if (statusOk) {
                  matchedDbCommand = dbCmd;
                  responsePreview = dryRun ? dbCmd.response : dbCmd.response;
                }
              }
            }
          }
        }

        if (!matchedBuiltIn && !matchedDbCommand) {
          // DB regex commands
          for (const cmd of dbCmds.filter((c) => c.regex)) {
            try {
              if (!new RegExp(cmd.regex!).test(message)) continue;
            } catch { continue; }

            if (!meetsLevel(accessLevel, cmd.accessLevel)) continue;
            const statusOk =
              cmd.streamStatus === "BOTH" ||
              (cmd.streamStatus === "ONLINE" && isLive) ||
              (cmd.streamStatus === "OFFLINE" && !isLive);
            if (!statusOk) continue;

            matchedDbCommand = cmd;
            responsePreview = dryRun ? cmd.response : cmd.response;
            break;
          }
        }
      }

      if (matchedKeyword && !responsePreview) {
        responsePreview = matchedKeyword.response;
      }

      return {
        spamCheck: spamResult,
        matchedKeyword: matchedKeyword
          ? {
              id: matchedKeyword.id,
              name: matchedKeyword.name,
              response: matchedKeyword.response,
              stopProcessing: matchedKeyword.stopProcessing,
            }
          : null,
        matchedBuiltIn,
        matchedDbCommand: matchedDbCommand
          ? {
              id: matchedDbCommand.id,
              name: matchedDbCommand.name,
              response: matchedDbCommand.response,
            }
          : null,
        responsePreview,
      };
    }),
});
