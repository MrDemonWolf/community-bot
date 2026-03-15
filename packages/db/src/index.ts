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

// Backwards-compatible alias
export const prisma = db;

export default db;

// Re-export everything from schema (tables, enums, relations)
export * from "./schema/index";

// Re-export model type aliases (drop-in for Prisma-generated types)
export * from "./types";

// Re-export drizzle utilities consumers need for queries
export { eq, ne, gt, gte, lt, lte, and, or, not, inArray, notInArray, isNull, isNotNull, between, like, ilike, exists, sql, asc, desc, count, sum, avg, max, min } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Enum value objects — drop-in replacements for Prisma enums
// Usage: TwitchAccessLevel.EVERYONE (same as before)
export const TwitchAccessLevel = {
  EVERYONE: "EVERYONE",
  SUBSCRIBER: "SUBSCRIBER",
  REGULAR: "REGULAR",
  VIP: "VIP",
  MODERATOR: "MODERATOR",
  LEAD_MODERATOR: "LEAD_MODERATOR",
  BROADCASTER: "BROADCASTER",
} as const;

export const TwitchResponseType = {
  SAY: "SAY",
  MENTION: "MENTION",
  REPLY: "REPLY",
} as const;

export const TwitchStreamStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  BOTH: "BOTH",
} as const;

export const QueueStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  PAUSED: "PAUSED",
} as const;

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

export const DiscordReportStatus = {
  OPEN: "OPEN",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;

export const DiscordScheduleType = {
  ONCE: "ONCE",
  RECURRING: "RECURRING",
} as const;
