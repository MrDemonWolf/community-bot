/**
 * Test database client and helpers for integration tests.
 *
 * Connects to `community_bot_test` PostgreSQL database. Each test file
 * should call `cleanDatabase()` in `beforeEach` to ensure a clean state.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema/index";
import {
  users,
  accounts,
  botChannels,
  twitchChatCommands,
  queueEntries,
  discordGuilds,
} from "./schema/index";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/community_bot_test";

const client = postgres(testDatabaseUrl);
export const testDb = drizzle(client, { schema });

// Backwards-compatible alias — will be removed once all tests are updated
export const testPrisma = testDb;

/**
 * Truncate all tables in the correct order (respecting FK constraints).
 * Uses TRUNCATE CASCADE for efficiency.
 */
export async function cleanDatabase(_db?: any): Promise<void> {
  const d = _db ?? testDb;
  await d.execute(sql`
    TRUNCATE TABLE
      "TwitchNotification",
      "TwitchChannel",
      "DefaultCommandOverride",
      "TwitchChatCommand",
      "PlaylistEntry",
      "Playlist",
      "SongRequest",
      "SongRequestSettings",
      "BotChannel",
      "Regular",
      "TwitchCredential",
      "QueueEntry",
      "QueueState",
      "AuditLog",
      "SystemConfig",
      "Session",
      "Account",
      "Verification",
      "DiscordGuild",
      "User"
    CASCADE
  `);
}

/* ------------------------------------------------------------------ */
/*  Seed Helpers                                                       */
/* ------------------------------------------------------------------ */

let seedCounter = 0;
function nextId(): string {
  seedCounter++;
  return `test-${seedCounter}-${Date.now()}`;
}

export interface SeedUserOptions {
  id?: string;
  name?: string;
  email?: string;
  role?: "USER" | "MODERATOR" | "LEAD_MODERATOR" | "BROADCASTER";
  banned?: boolean;
  banReason?: string | null;
}

export async function seedUser(
  _db: any,
  opts: SeedUserOptions = {}
) {
  const id = opts.id ?? nextId();
  const d = _db ?? testDb;
  const [result] = await d.insert(users).values({
    id,
    name: opts.name ?? `User-${id}`,
    email: opts.email ?? `${id}@test.local`,
    role: opts.role ?? "USER",
    banned: opts.banned ?? false,
    banReason: opts.banReason ?? null,
    updatedAt: new Date(),
  }).returning();
  return result;
}

export interface SeedBotChannelOptions {
  userId: string;
  twitchUsername?: string;
  twitchUserId?: string;
  enabled?: boolean;
  muted?: boolean;
}

export async function seedBotChannel(
  _db: any,
  opts: SeedBotChannelOptions
) {
  const d = _db ?? testDb;
  const [result] = await d.insert(botChannels).values({
    userId: opts.userId,
    twitchUsername: opts.twitchUsername ?? `twitch_${opts.userId}`,
    twitchUserId: opts.twitchUserId ?? `tid_${opts.userId}`,
    enabled: opts.enabled ?? true,
    muted: opts.muted ?? false,
    updatedAt: new Date(),
  }).returning();
  return result;
}

export interface SeedCommandOptions {
  botChannelId: string;
  name?: string;
  response?: string;
  enabled?: boolean;
  aliases?: string[];
  regex?: string | null;
  accessLevel?:
    | "EVERYONE"
    | "SUBSCRIBER"
    | "REGULAR"
    | "VIP"
    | "MODERATOR"
    | "LEAD_MODERATOR"
    | "BROADCASTER";
}

export async function seedCommand(
  _db: any,
  opts: SeedCommandOptions
) {
  const d = _db ?? testDb;
  const [result] = await d.insert(twitchChatCommands).values({
    name: opts.name ?? `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    response: opts.response ?? "Test response",
    botChannelId: opts.botChannelId,
    enabled: opts.enabled ?? true,
    aliases: opts.aliases ?? [],
    regex: opts.regex ?? null,
    accessLevel: opts.accessLevel ?? "EVERYONE",
    updatedAt: new Date(),
  }).returning();
  return result;
}

export interface SeedQueueEntryOptions {
  twitchUserId?: string;
  twitchUsername?: string;
  position: number;
}

export async function seedQueueEntry(
  _db: any,
  opts: SeedQueueEntryOptions
) {
  const uid = opts.twitchUserId ?? nextId();
  const d = _db ?? testDb;
  const [result] = await d.insert(queueEntries).values({
    twitchUserId: uid,
    twitchUsername: opts.twitchUsername ?? `viewer_${uid}`,
    position: opts.position,
  }).returning();
  return result;
}

export async function seedDiscordGuild(
  _db: any,
  opts: { guildId?: string; name?: string; enabled?: boolean } = {}
) {
  const d = _db ?? testDb;
  const [result] = await d.insert(discordGuilds).values({
    guildId: opts.guildId ?? nextId(),
    name: opts.name ?? "Test Guild",
    enabled: opts.enabled ?? true,
    updatedAt: new Date(),
  }).returning();
  return result;
}

export async function seedAccount(
  _db: any,
  opts: {
    userId: string;
    providerId?: string;
    accountId?: string;
  }
) {
  const d = _db ?? testDb;
  const [result] = await d.insert(accounts).values({
    id: nextId(),
    userId: opts.userId,
    providerId: opts.providerId ?? "twitch",
    accountId: opts.accountId ?? `twitch_${opts.userId}`,
    updatedAt: new Date(),
  }).returning();
  return result;
}
