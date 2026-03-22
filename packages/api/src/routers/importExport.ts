/**
 * Import/Export Router — Export channel data and import from Nightbot or community-bot format.
 */
import {
  db, eq, and,
  twitchChatCommands, twitchTimers, twitchCounters, quotes,
  regulars, spamFilters, keywords,
  TwitchAccessLevel, TwitchResponseType, TwitchStreamStatus,
} from "@community-bot/db";

type AccessLevel = (typeof TwitchAccessLevel)[keyof typeof TwitchAccessLevel];
type ResponseType = (typeof TwitchResponseType)[keyof typeof TwitchResponseType];
type StreamStatus = (typeof TwitchStreamStatus)[keyof typeof TwitchStreamStatus];

const ACCESS_LEVELS = new Set(Object.values(TwitchAccessLevel));
const RESPONSE_TYPES = new Set(Object.values(TwitchResponseType));
const STREAM_STATUSES = new Set(Object.values(TwitchStreamStatus));

function toAccessLevel(value?: string, fallback: AccessLevel = "EVERYONE"): AccessLevel {
  return value && ACCESS_LEVELS.has(value as AccessLevel) ? (value as AccessLevel) : fallback;
}

function toResponseType(value?: string, fallback: ResponseType = "SAY"): ResponseType {
  return value && RESPONSE_TYPES.has(value as ResponseType) ? (value as ResponseType) : fallback;
}

function toStreamStatus(value?: string, fallback: StreamStatus = "BOTH"): StreamStatus {
  return value && STREAM_STATUSES.has(value as StreamStatus) ? (value as StreamStatus) : fallback;
}

import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { applyMutationEffects } from "../utils/mutation";
import { getUserBotChannel } from "../utils/botChannel";

/** Nightbot command shape (CSV/JSON from export) */
interface NightbotCommand {
  name: string;
  message: string;
  cooldown?: number;
  userlevel?: string;
  count?: number;
}

function nightbotUserlevelToAccessLevel(level?: string): AccessLevel {
  switch (level?.toLowerCase()) {
    case "owner": return "BROADCASTER";
    case "moderator": case "mod": return "MODERATOR";
    case "subscriber": case "sub": return "SUBSCRIBER";
    case "regular": return "REGULAR";
    default: return "EVERYONE";
  }
}

/** community-bot JSON export format version */
const EXPORT_FORMAT_VERSION = "1.0";

export const importExportRouter = router({
  /** Export selected data types as a JSON blob */
  export: protectedProcedure
    .input(
      z.object({
        include: z.object({
          commands: z.boolean().default(true),
          timers: z.boolean().default(true),
          keywords: z.boolean().default(true),
          counters: z.boolean().default(true),
          quotes: z.boolean().default(false),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const result: Record<string, unknown> = {
        version: EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        channelUsername: botChannel.twitchUsername,
      };

      if (input.include.commands) {
        result.commands = await db.query.twitchChatCommands.findMany({
          where: eq(twitchChatCommands.botChannelId, botChannel.id),
        });
      }
      if (input.include.timers) {
        result.timers = await db.query.twitchTimers.findMany({
          where: eq(twitchTimers.botChannelId, botChannel.id),
        });
      }
      if (input.include.keywords) {
        result.keywords = await db.query.keywords.findMany({
          where: eq(keywords.botChannelId, botChannel.id),
        });
      }
      if (input.include.counters) {
        result.counters = await db.query.twitchCounters.findMany({
          where: eq(twitchCounters.botChannelId, botChannel.id),
        });
      }
      if (input.include.quotes) {
        result.quotes = await db.query.quotes.findMany({
          where: eq(quotes.botChannelId, botChannel.id),
        });
      }

      await applyMutationEffects(ctx, {
        audit: { action: "export.all", resourceType: "Export", resourceId: botChannel.id, metadata: { include: input.include } },
      });

      return result;
    }),

  /** Import commands from Nightbot JSON format */
  importNightbot: moderatorProcedure
    .input(
      z.object({
        commands: z.array(
          z.object({
            name: z.string().min(1).max(100),
            message: z.string().min(1).max(500),
            cooldown: z.number().int().min(0).max(86400).optional(),
            userlevel: z.string().optional(),
            count: z.number().int().min(0).optional(),
          })
        ).min(1).max(500),
        conflictResolution: z.enum(["skip", "overwrite"]).default("skip"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      let created = 0;
      let skipped = 0;
      let overwritten = 0;

      for (const cmd of input.commands) {
        // Strip ! prefix from name if present
        const name = cmd.name.replace(/^!/, "").toLowerCase().trim();
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) { skipped++; continue; }

        const existing = await db.query.twitchChatCommands.findFirst({
          where: and(
            eq(twitchChatCommands.name, name),
            eq(twitchChatCommands.botChannelId, botChannel.id)
          ),
        });

        if (existing) {
          if (input.conflictResolution === "skip") { skipped++; continue; }
          // overwrite
          await db.update(twitchChatCommands)
            .set({
              response: cmd.message,
              globalCooldown: cmd.cooldown ?? 0,
              accessLevel: nightbotUserlevelToAccessLevel(cmd.userlevel),
              useCount: cmd.count ?? 0,
            })
            .where(eq(twitchChatCommands.id, existing.id));
          overwritten++;
        } else {
          await db.insert(twitchChatCommands).values({
            name,
            response: cmd.message,
            globalCooldown: cmd.cooldown ?? 0,
            accessLevel: nightbotUserlevelToAccessLevel(cmd.userlevel),
            useCount: cmd.count ?? 0,
            botChannelId: botChannel.id,
          });
          created++;
        }
      }

      await applyMutationEffects(ctx, {
        audit: { action: "import.nightbot", resourceType: "TwitchChatCommand", resourceId: botChannel.id, metadata: { created, skipped, overwritten } },
      });

      return { created, skipped, overwritten };
    }),

  /** Import from community-bot JSON format */
  importCommunityBot: moderatorProcedure
    .input(
      z.object({
        data: z.object({
          version: z.string(),
          commands: z.array(z.object({
            name: z.string(),
            response: z.string(),
            responseType: z.string().optional(),
            globalCooldown: z.number().optional(),
            userCooldown: z.number().optional(),
            accessLevel: z.string().optional(),
            streamStatus: z.string().optional(),
            enabled: z.boolean().optional(),
          })).optional(),
          timers: z.array(z.object({
            name: z.string(),
            message: z.string(),
            intervalMinutes: z.number().optional(),
            onlineIntervalSeconds: z.number().optional(),
            chatLines: z.number().optional(),
            enabled: z.boolean().optional(),
          })).optional(),
          keywords: z.array(z.object({
            name: z.string(),
            phraseGroups: z.array(z.array(z.string())),
            response: z.string(),
            accessLevel: z.string().optional(),
            enabled: z.boolean().optional(),
          })).optional(),
        }),
        conflictResolution: z.enum(["skip", "overwrite"]).default("skip"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const stats = { commands: { created: 0, skipped: 0, overwritten: 0 }, timers: { created: 0, skipped: 0, overwritten: 0 }, keywords: { created: 0, skipped: 0, overwritten: 0 } };

      // Import commands
      for (const cmd of input.data.commands ?? []) {
        const name = cmd.name.toLowerCase().trim();
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) { stats.commands.skipped++; continue; }

        const existing = await db.query.twitchChatCommands.findFirst({
          where: and(eq(twitchChatCommands.name, name), eq(twitchChatCommands.botChannelId, botChannel.id)),
        });

        if (existing) {
          if (input.conflictResolution === "skip") { stats.commands.skipped++; continue; }
          await db.update(twitchChatCommands)
            .set({
              response: cmd.response,
              responseType: toResponseType(cmd.responseType),
              globalCooldown: cmd.globalCooldown ?? 0,
              userCooldown: cmd.userCooldown ?? 0,
              accessLevel: toAccessLevel(cmd.accessLevel),
              streamStatus: toStreamStatus(cmd.streamStatus),
              enabled: cmd.enabled ?? true,
            })
            .where(eq(twitchChatCommands.id, existing.id));
          stats.commands.overwritten++;
        } else {
          await db.insert(twitchChatCommands).values({
            name,
            response: cmd.response,
            responseType: toResponseType(cmd.responseType),
            globalCooldown: cmd.globalCooldown ?? 0,
            userCooldown: cmd.userCooldown ?? 0,
            accessLevel: toAccessLevel(cmd.accessLevel),
            streamStatus: toStreamStatus(cmd.streamStatus),
            enabled: cmd.enabled ?? true,
            botChannelId: botChannel.id,
          });
          stats.commands.created++;
        }
      }

      // Import timers
      for (const timer of input.data.timers ?? []) {
        const name = timer.name.toLowerCase().trim();
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) { stats.timers.skipped++; continue; }

        const existing = await db.query.twitchTimers.findFirst({
          where: and(eq(twitchTimers.name, name), eq(twitchTimers.botChannelId, botChannel.id)),
        });

        if (existing) {
          if (input.conflictResolution === "skip") { stats.timers.skipped++; continue; }
          await db.update(twitchTimers)
            .set({
              message: timer.message,
              intervalMinutes: timer.intervalMinutes ?? 5,
              onlineIntervalSeconds: timer.onlineIntervalSeconds ?? (timer.intervalMinutes ?? 5) * 60,
              chatLines: timer.chatLines ?? 0,
              enabled: timer.enabled ?? true,
            })
            .where(eq(twitchTimers.id, existing.id));
          stats.timers.overwritten++;
        } else {
          await db.insert(twitchTimers).values({
            name,
            message: timer.message,
            intervalMinutes: timer.intervalMinutes ?? 5,
            onlineIntervalSeconds: timer.onlineIntervalSeconds ?? (timer.intervalMinutes ?? 5) * 60,
            chatLines: timer.chatLines ?? 0,
            enabled: timer.enabled ?? true,
            botChannelId: botChannel.id,
          });
          stats.timers.created++;
        }
      }

      // Import keywords
      for (const kw of input.data.keywords ?? []) {
        const name = kw.name.toLowerCase().trim();
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) { stats.keywords.skipped++; continue; }

        const existing = await db.query.keywords.findFirst({
          where: and(eq(keywords.name, name), eq(keywords.botChannelId, botChannel.id)),
        });

        if (existing) {
          if (input.conflictResolution === "skip") { stats.keywords.skipped++; continue; }
          await db.update(keywords)
            .set({ phraseGroups: kw.phraseGroups, response: kw.response, enabled: kw.enabled ?? true })
            .where(eq(keywords.id, existing.id));
          stats.keywords.overwritten++;
        } else {
          await db.insert(keywords).values({
            name,
            phraseGroups: kw.phraseGroups,
            response: kw.response,
            accessLevel: toAccessLevel(kw.accessLevel),
            enabled: kw.enabled ?? true,
            botChannelId: botChannel.id,
          });
          stats.keywords.created++;
        }
      }

      await applyMutationEffects(ctx, {
        audit: { action: "import.community-bot", resourceType: "Import", resourceId: botChannel.id, metadata: stats },
      });

      return stats;
    }),
});
