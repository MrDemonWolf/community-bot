import { ChatClient, ChatMessage } from "@twurple/chat";

import { prisma, TwitchResponseType } from "@community-bot/db";
import { getRandomChatter, getChattersCount } from "./chatterTracker.js";
import { getUserAccessLevel } from "./accessControl.js";
import {
  isLive,
  getTitle,
  getGame,
  getGamesPlayed,
  getStreamStartedAt,
  getWentOfflineAt,
} from "./streamStatusManager.js";
import {
  getFollowage,
  getAccountAge,
  getSubCount,
  getTwitchEmotes,
} from "./helixHelpers.js";
import { get7TVEmotes, getBTTVEmotes, getFFZEmotes } from "./emoteHelpers.js";
import { getWeather } from "./weatherHelper.js";
import { logger } from "../utils/logger.js";

export interface CommandContext {
  user: string;
  channel: string;
  args: string[];
  msg: ChatMessage;
  commandId?: string;
  broadcasterId?: string;
}

// ── Math expression parser (no eval) ──

function parseMathExpr(expr: string): number {
  let pos = 0;
  const str = expr.replace(/\s+/g, "");

  function parseNumber(): number {
    let negative = false;
    if (str[pos] === "-") {
      negative = true;
      pos++;
    }
    if (str[pos] === "(") {
      pos++; // skip (
      const val = parseAddSub();
      pos++; // skip )
      return negative ? -val : val;
    }
    const start = pos;
    while (pos < str.length && (str[pos] >= "0" && str[pos] <= "9" || str[pos] === ".")) {
      pos++;
    }
    const num = parseFloat(str.slice(start, pos));
    if (isNaN(num)) throw new Error("Invalid number");
    return negative ? -num : num;
  }

  function parseMulDiv(): number {
    let left = parseNumber();
    while (pos < str.length && (str[pos] === "*" || str[pos] === "/" || str[pos] === "%")) {
      const op = str[pos++];
      const right = parseNumber();
      if (op === "*") left *= right;
      else if (op === "/") left = right === 0 ? 0 : left / right;
      else left = right === 0 ? 0 : left % right;
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (pos < str.length && (str[pos] === "+" || str[pos] === "-")) {
      const op = str[pos++];
      const right = parseMulDiv();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }

  const result = parseAddSub();
  // Round to 2 decimal places to avoid floating point noise
  return Math.round(result * 100) / 100;
}

// ── Duration formatting helpers ──

function formatUptime(startedAt: Date | null): string {
  if (!startedAt) return "(offline)";
  const ms = Date.now() - startedAt.getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDowntime(wentOfflineAt: Date | null): string {
  if (!wentOfflineAt) return "(unknown)";
  const ms = Date.now() - wentOfflineAt.getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCountdown(targetStr: string): string {
  try {
    const target = new Date(targetStr.trim());
    if (isNaN(target.getTime())) return "(invalid date)";
    const ms = target.getTime() - Date.now();
    if (ms <= 0) return "0s (passed)";
    return formatTimeDiff(ms);
  } catch {
    return "(invalid date)";
  }
}

function formatCountup(targetStr: string): string {
  try {
    const target = new Date(targetStr.trim());
    if (isNaN(target.getTime())) return "(invalid date)";
    const ms = Date.now() - target.getTime();
    if (ms <= 0) return "0s (in the future)";
    return formatTimeDiff(ms);
  } catch {
    return "(invalid date)";
  }
}

function formatTimeDiff(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months % 12 > 0) parts.push(`${months % 12} month${months % 12 !== 1 ? "s" : ""}`);
  if (days % 30 > 0 && years === 0) parts.push(`${days % 30} day${days % 30 !== 1 ? "s" : ""}`);
  if (hours % 24 > 0 && months === 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0 && days === 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);

  return parts.slice(0, 3).join(", ");
}

// ── Async regex replacer ──

async function replaceAsync(
  str: string,
  regex: RegExp,
  fn: (match: string, ...groups: string[]) => Promise<string>
): Promise<string> {
  const promises: Promise<string>[] = [];
  str.replace(regex, (match, ...groups) => {
    promises.push(fn(match, ...groups));
    return match;
  });
  const results = await Promise.all(promises);
  let i = 0;
  return str.replace(regex, () => results[i++]);
}

// ── Main substitution ──

export async function substituteVariables(
  template: string,
  ctx: CommandContext
): Promise<string> {
  const { user, channel, args, msg, commandId, broadcasterId } = ctx;
  let result = template;

  // ── 1. Simple sync {…} replacements ──
  const argsJoined = args.join(" ");
  const touser = args[0] ?? user;
  const query = argsJoined || user;
  const userLevel = getUserAccessLevel(msg).toLowerCase();

  result = result
    .replace(/\{user\}/gi, user)
    .replace(/\{channel\}/gi, channel)
    .replace(/\{args\}/gi, argsJoined)
    .replace(/\{touser\}/gi, touser)
    .replace(/\{query\}/gi, query)
    .replace(/\{userlevel\}/gi, userLevel)
    .replace(/\{userid\}/gi, msg.userInfo.userId)
    .replace(/\{displayname\}/gi, msg.userInfo.displayName ?? user)
    .replace(/\{chatters\}/gi, String(getChattersCount(channel)))
    .replace(/\{uptime\}/gi, formatUptime(getStreamStartedAt(channel)))
    .replace(/\{downtime\}/gi, formatDowntime(getWentOfflineAt(channel)))
    .replace(/\{title\}/gi, getTitle(channel) || "(no title)")
    .replace(/\{game\}/gi, getGame(channel) || "(no game)")
    .replace(/\{gamesplayed\}/gi, getGamesPlayed(channel) || "(none)")
    .replace(/\{querystring\}/gi, encodeURIComponent(argsJoined));

  // ── 2. Parameterized sync {…} replacements ──

  // {random.N-M}
  result = result.replace(
    /\{random\.(\d+)-(\d+)\}/gi,
    (_match, minStr: string, maxStr: string) => {
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      if (min > max) return String(min);
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
  );

  // {countdown <datetime>}
  result = result.replace(
    /\{countdown\s+([^}]+)\}/gi,
    (_match, dateStr: string) => formatCountdown(dateStr)
  );

  // {countup <datetime>}
  result = result.replace(
    /\{countup\s+([^}]+)\}/gi,
    (_match, dateStr: string) => formatCountup(dateStr)
  );

  // {math <expr>}
  result = result.replace(
    /\{math\s+([^}]+)\}/gi,
    (_match, expr: string) => {
      try {
        return String(parseMathExpr(expr));
      } catch {
        return "(math error)";
      }
    }
  );

  // {repeat '<text>' <N>}
  result = result.replace(
    /\{repeat\s+'([^']*)'\s+(\d+)\}/gi,
    (_match, text: string, countStr: string) => {
      const count = Math.min(parseInt(countStr, 10), 50);
      return text.repeat(count);
    }
  );

  // {urlencode <text>}
  result = result.replace(
    /\{urlencode\s+([^}]+)\}/gi,
    (_match, text: string) => encodeURIComponent(text.trim())
  );

  // ── 3. Existing ${…} advanced replacements ──

  // Positional args: ${N} or ${N|fallback} (1-indexed)
  result = result.replace(
    /\$\{(\d+)(?:\|'?([^}']*)'?)?\}/g,
    (_match, indexStr: string, fallback: string | undefined) => {
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < args.length && args[index] !== undefined) {
        return args[index];
      }
      return fallback ?? "";
    }
  );

  // ${random.pick '...' '...'}
  result = result.replace(
    /\$\{random\.pick\s+((?:'[^']*'\s*)+)\}/gi,
    (_match, optionsStr: string) => {
      const options = [...optionsStr.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      if (options.length === 0) return "";
      return options[Math.floor(Math.random() * options.length)];
    }
  );

  // ${random.chatter}
  result = result.replace(/\$\{random\.chatter\}/gi, () => {
    return getRandomChatter(channel) ?? user;
  });

  // ${time <timezone>}
  result = result.replace(
    /\$\{time\s+([^}]+)\}/gi,
    (_match, timezone: string) => {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: timezone.trim(),
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date());
      } catch {
        return `(invalid timezone: ${timezone.trim()})`;
      }
    }
  );

  // ── 4. Async {…} replacements ──

  // {count} — auto-increment command use count
  if (/\{count\}/i.test(result) && commandId) {
    try {
      const updated = await prisma.twitchChatCommand.update({
        where: { id: commandId },
        data: { useCount: { increment: 1 } },
        select: { useCount: true },
      });
      result = result.replace(/\{count\}/gi, String(updated.useCount));
    } catch {
      result = result.replace(/\{count\}/gi, "(count error)");
    }
  } else {
    result = result.replace(/\{count\}/gi, "0");
  }

  // {followage}
  if (/\{followage\}/i.test(result) && broadcasterId) {
    const followage = await getFollowage(broadcasterId, msg.userInfo.userId);
    result = result.replace(/\{followage\}/gi, followage);
  }

  // {accountage}
  if (/\{accountage\}/i.test(result)) {
    const age = await getAccountAge(msg.userInfo.userId);
    result = result.replace(/\{accountage\}/gi, age);
  }

  // {subcount}
  if (/\{subcount\}/i.test(result) && broadcasterId) {
    const count = await getSubCount(broadcasterId);
    result = result.replace(/\{subcount\}/gi, count);
  }

  // {7tvemotes}
  if (/\{7tvemotes\}/i.test(result) && broadcasterId) {
    const emotes = await get7TVEmotes(broadcasterId);
    result = result.replace(/\{7tvemotes\}/gi, emotes);
  }

  // {bttvemotes}
  if (/\{bttvemotes\}/i.test(result) && broadcasterId) {
    const emotes = await getBTTVEmotes(broadcasterId);
    result = result.replace(/\{bttvemotes\}/gi, emotes);
  }

  // {ffzemotes}
  if (/\{ffzemotes\}/i.test(result) && broadcasterId) {
    const emotes = await getFFZEmotes(broadcasterId);
    result = result.replace(/\{ffzemotes\}/gi, emotes);
  }

  // {twitchemotes}
  if (/\{twitchemotes\}/i.test(result) && broadcasterId) {
    const emotes = await getTwitchEmotes(broadcasterId);
    result = result.replace(/\{twitchemotes\}/gi, emotes);
  }

  // {counter <name>} — returns current value of a named counter
  if (/\{counter\s+[^}]+\}/i.test(result)) {
    result = await replaceAsync(
      result,
      /\{counter\s+([^}]+)\}/gi,
      async (_match, counterName: string) => {
        try {
          const channelName = channel.replace(/^#/, "").toLowerCase();
          const botChannel = await prisma.botChannel.findFirst({
            where: { twitchUsername: channelName },
            select: { id: true },
          });
          if (!botChannel) return "(counter error)";

          const counter = await prisma.twitchCounter.findUnique({
            where: { name_botChannelId: { name: counterName.trim().toLowerCase(), botChannelId: botChannel.id } },
          });
          return counter ? String(counter.value) : "0";
        } catch {
          return "(counter error)";
        }
      }
    );
  }

  // {weather <location>}
  result = await replaceAsync(
    result,
    /\{weather\s+([^}]+)\}/gi,
    async (_match, location: string) => getWeather(location)
  );

  // ── 5. {customapi <url>} — processed last so variables in URLs resolve first ──
  result = await replaceAsync(
    result,
    /\{customapi\s+([^}]+)\}/gi,
    async (_match, url: string) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl.startsWith("https://")) return "(only https:// URLs allowed)";
      try {
        const res = await fetch(trimmedUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "CommunityBot/1.0" },
        });
        if (!res.ok) return "(API error)";
        const text = await res.text();
        return text.length > 400 ? text.slice(0, 400) + "..." : text;
      } catch {
        return "(API error)";
      }
    }
  );

  return result;
}

export async function executeCommand(
  client: ChatClient,
  channel: string,
  user: string,
  args: string[],
  msg: ChatMessage,
  response: string,
  responseType: TwitchResponseType,
  commandId?: string,
  broadcasterId?: string
): Promise<void> {
  const ctx: CommandContext = {
    user,
    channel,
    args,
    msg,
    commandId,
    broadcasterId,
  };

  let text: string;
  try {
    text = await substituteVariables(response, ctx);
  } catch (err) {
    logger.warn("CommandExecutor", "Variable substitution error", err instanceof Error ? { error: err.message } : undefined);
    text = response; // fall back to raw template
  }

  switch (responseType) {
    case TwitchResponseType.SAY:
      await client.say(channel, text);
      break;
    case TwitchResponseType.MENTION:
      await client.say(channel, `@${user} ${text}`);
      break;
    case TwitchResponseType.REPLY:
      await client.say(channel, text, { replyTo: msg });
      break;
  }
}
