/**
 * Test database client and helpers for integration tests.
 *
 * Connects to `community_bot_test` PostgreSQL database. Each test file
 * should call `cleanDatabase()` in `beforeEach` to ensure a clean state.
 */
import { PrismaClient } from "../prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/community_bot_test";

const adapter = new PrismaPg({ connectionString: testDatabaseUrl });

export const testPrisma = new PrismaClient({ adapter });

/**
 * Truncate all tables in the correct order (respecting FK constraints).
 * Uses TRUNCATE CASCADE for efficiency.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
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
  prisma: PrismaClient,
  opts: SeedUserOptions = {}
) {
  const id = opts.id ?? nextId();
  return prisma.user.create({
    data: {
      id,
      name: opts.name ?? `User-${id}`,
      email: opts.email ?? `${id}@test.local`,
      role: opts.role ?? "USER",
      banned: opts.banned ?? false,
      banReason: opts.banReason ?? null,
    },
  });
}

export interface SeedBotChannelOptions {
  userId: string;
  twitchUsername?: string;
  twitchUserId?: string;
  enabled?: boolean;
  muted?: boolean;
}

export async function seedBotChannel(
  prisma: PrismaClient,
  opts: SeedBotChannelOptions
) {
  return prisma.botChannel.create({
    data: {
      userId: opts.userId,
      twitchUsername: opts.twitchUsername ?? `twitch_${opts.userId}`,
      twitchUserId: opts.twitchUserId ?? `tid_${opts.userId}`,
      enabled: opts.enabled ?? true,
      muted: opts.muted ?? false,
    },
  });
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
  prisma: PrismaClient,
  opts: SeedCommandOptions
) {
  return prisma.twitchChatCommand.create({
    data: {
      name: opts.name ?? `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      response: opts.response ?? "Test response",
      botChannelId: opts.botChannelId,
      enabled: opts.enabled ?? true,
      aliases: opts.aliases ?? [],
      regex: opts.regex ?? null,
      accessLevel: opts.accessLevel ?? "EVERYONE",
    },
  });
}

export interface SeedQueueEntryOptions {
  twitchUserId?: string;
  twitchUsername?: string;
  position: number;
}

export async function seedQueueEntry(
  prisma: PrismaClient,
  opts: SeedQueueEntryOptions
) {
  const uid = opts.twitchUserId ?? nextId();
  return prisma.queueEntry.create({
    data: {
      twitchUserId: uid,
      twitchUsername: opts.twitchUsername ?? `viewer_${uid}`,
      position: opts.position,
    },
  });
}

export async function seedDiscordGuild(
  prisma: PrismaClient,
  opts: { guildId?: string; name?: string; enabled?: boolean } = {}
) {
  return prisma.discordGuild.create({
    data: {
      guildId: opts.guildId ?? nextId(),
      name: opts.name ?? "Test Guild",
      enabled: opts.enabled ?? true,
    },
  });
}

export async function seedAccount(
  prisma: PrismaClient,
  opts: {
    userId: string;
    providerId?: string;
    accountId?: string;
  }
) {
  return prisma.account.create({
    data: {
      id: nextId(),
      userId: opts.userId,
      providerId: opts.providerId ?? "twitch",
      accountId: opts.accountId ?? `twitch_${opts.userId}`,
    },
  });
}
