/**
 * @community-bot/db — Shared Drizzle ORM client and type re-exports.
 *
 * Uses postgres.js driver for native PostgreSQL connections.
 * All apps import the `db` client and schema from this package.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });

export default db;

// Re-export everything from schema (tables, enums, relations)
export * from "./schema/index";

// Re-export model type aliases
export * from "./types";

// Re-export drizzle utilities consumers need for queries
export { eq, ne, gt, gte, lt, lte, and, or, not, inArray, notInArray, isNull, isNotNull, between, like, ilike, exists, sql, asc, desc, count, sum, avg, max, min } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/** Twitch command access levels — who can run a command (EVERYONE through BROADCASTER). */
export const TwitchAccessLevel = {
  EVERYONE: "EVERYONE",
  SUBSCRIBER: "SUBSCRIBER",
  REGULAR: "REGULAR",
  VIP: "VIP",
  MODERATOR: "MODERATOR",
  LEAD_MODERATOR: "LEAD_MODERATOR",
  BROADCASTER: "BROADCASTER",
} as const;

/** How the bot delivers a command response: plain message, @mention, or threaded reply. */
export const TwitchResponseType = {
  SAY: "SAY",
  MENTION: "MENTION",
  REPLY: "REPLY",
} as const;

/** When a command is active: only while ONLINE, only while OFFLINE, or BOTH. */
export const TwitchStreamStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  BOTH: "BOTH",
} as const;

/** Viewer queue state: OPEN (accepting joins), PAUSED (frozen), or CLOSED. */
export const QueueStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  PAUSED: "PAUSED",
} as const;

/** Dashboard user roles — ascending privilege: USER → MODERATOR → LEAD_MODERATOR → BROADCASTER. */
export const UserRole = {
  USER: "USER",
  MODERATOR: "MODERATOR",
  LEAD_MODERATOR: "LEAD_MODERATOR",
  BROADCASTER: "BROADCASTER",
} as const;

// Type aliases for enum value unions (use in type positions)
export type TwitchAccessLevel = (typeof TwitchAccessLevel)[keyof typeof TwitchAccessLevel];
export type TwitchResponseType = (typeof TwitchResponseType)[keyof typeof TwitchResponseType];
export type TwitchStreamStatus = (typeof TwitchStreamStatus)[keyof typeof TwitchStreamStatus];
export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Discord moderation case types (ban, kick, warn, mute, and their reversals). */
export const DiscordCaseType = {
  BAN: "BAN",
  TEMPBAN: "TEMPBAN",
  KICK: "KICK",
  WARN: "WARN",
  MUTE: "MUTE",
  UNBAN: "UNBAN",
  UNWARN: "UNWARN",
  UNMUTE: "UNMUTE",
  NOTE: "NOTE",
} as const;

/** Discord user report lifecycle: OPEN → INVESTIGATING → RESOLVED or DISMISSED. */
export const DiscordReportStatus = {
  OPEN: "OPEN",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;

/** Scheduled message frequency: fire ONCE or on a RECURRING cron. */
export const DiscordScheduleType = {
  ONCE: "ONCE",
  RECURRING: "RECURRING",
} as const;
