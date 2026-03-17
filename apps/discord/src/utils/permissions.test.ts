import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      discordGuilds: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  eq: vi.fn(), and: vi.fn(), or: vi.fn(), not: vi.fn(),
  gt: vi.fn(), gte: vi.fn(), lt: vi.fn(), lte: vi.fn(), ne: vi.fn(),
  like: vi.fn(), ilike: vi.fn(), inArray: vi.fn(), notInArray: vi.fn(),
  isNull: vi.fn(), isNotNull: vi.fn(),
  asc: vi.fn(), desc: vi.fn(), count: vi.fn(), sql: vi.fn(),
  between: vi.fn(), exists: vi.fn(), notExists: vi.fn(),
  // Table schemas (empty objects)
  users: {}, accounts: {}, sessions: {}, botChannels: {},
  twitchChatCommands: {}, twitchRegulars: {}, twitchCounters: {},
  twitchTimers: {}, twitchChannels: {}, twitchNotifications: {},
  twitchCredentials: {}, quotes: {}, songRequests: {},
  songRequestSettings: {}, bannedTracks: {}, playlists: {},
  playlistEntries: {}, giveaways: {}, giveawayEntries: {},
  polls: {}, pollOptions: {}, pollVotes: {},
  queueEntries: {}, queueStates: {},
  discordGuilds: {}, auditLogs: {}, systemConfigs: {},
  defaultCommandOverrides: {}, spamFilters: {}, spamPermits: {},
  regulars: {},
  // Enums
  QueueStatus: { OPEN: "OPEN", CLOSED: "CLOSED", PAUSED: "PAUSED" },
  TwitchAccessLevel: {
    EVERYONE: "EVERYONE", SUBSCRIBER: "SUBSCRIBER", REGULAR: "REGULAR",
    VIP: "VIP", MODERATOR: "MODERATOR", LEAD_MODERATOR: "LEAD_MODERATOR",
    BROADCASTER: "BROADCASTER",
  },
}));
vi.mock("discord.js", () => ({
  PermissionFlagsBits: { ManageGuild: 32n, ManageMessages: 8192n },
}));

import { hasPermission, clearGuildRoleCache } from "./permissions.js";

describe("permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGuildRoleCache("guild-1");
  });

  const mockInteraction = (memberRoles: string[], guildId: string | null = "guild-1") => ({
    guildId,
    member: {
      roles: { cache: new Map(memberRoles.map(r => [r, { id: r }])) },
      permissions: { has: vi.fn().mockReturnValue(false) },
    },
  });

  it("returns true when user has the configured admin role", async () => {
    mocks.db.query.discordGuilds.findFirst.mockResolvedValue({
      adminRoleId: "admin-role",
      modRoleId: null,
    });
    const interaction = mockInteraction(["admin-role"]);
    const result = await hasPermission(interaction as any, "admin");
    expect(result).toBe(true);
  });

  it("returns false when user lacks the admin role", async () => {
    mocks.db.query.discordGuilds.findFirst.mockResolvedValue({
      adminRoleId: "admin-role",
      modRoleId: null,
    });
    const interaction = mockInteraction(["other-role"]);
    const result = await hasPermission(interaction as any, "admin");
    expect(result).toBe(false);
  });

  it("returns true for mod when user has mod role", async () => {
    mocks.db.query.discordGuilds.findFirst.mockResolvedValue({
      adminRoleId: null,
      modRoleId: "mod-role",
    });
    const interaction = mockInteraction(["mod-role"]);
    const result = await hasPermission(interaction as any, "mod");
    expect(result).toBe(true);
  });

  it("returns true for mod when user has admin role", async () => {
    mocks.db.query.discordGuilds.findFirst.mockResolvedValue({
      adminRoleId: "admin-role",
      modRoleId: null,
    });
    const interaction = mockInteraction(["admin-role"]);
    const result = await hasPermission(interaction as any, "mod");
    expect(result).toBe(true);
  });

  it("returns false when no guildId on interaction", async () => {
    const interaction = mockInteraction([], null);
    const result = await hasPermission(interaction as any, "admin");
    expect(result).toBe(false);
  });
});
