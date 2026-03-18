import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const insertValues = vi.fn();
  return {
    db: {
      query: {
        users: { findFirst: vi.fn() },
      },
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    },
    insertValues,
  };
});

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

import { logAudit } from "./audit";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.insert.mockReturnValue({ values: mocks.insertValues });
    mocks.insertValues.mockResolvedValue(undefined);
  });

  it("looks up the user role and creates an audit log entry", async () => {
    mocks.db.query.users.findFirst.mockResolvedValue({ role: "MODERATOR" });

    await logAudit({
      userId: "u1",
      userName: "Alice",
      action: "bot.enable",
      resourceType: "BotChannel",
      resourceId: "bc1" });

    expect(mocks.db.query.users.findFirst).toHaveBeenCalled();
    expect(mocks.db.insert).toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        userName: "Alice",
        userRole: "MODERATOR",
        action: "bot.enable",
        resourceType: "BotChannel",
        resourceId: "bc1" }));
  });

  it("defaults to USER role when user is not found", async () => {
    mocks.db.query.users.findFirst.mockResolvedValue(null);

    await logAudit({
      userId: "missing",
      userName: "Ghost",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1" });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userRole: "USER" }));
  });

  it("stores optional metadata and ipAddress", async () => {
    mocks.db.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });

    await logAudit({
      userId: "u1",
      userName: "Admin",
      action: "command.create",
      resourceType: "TwitchChatCommand",
      resourceId: "cmd1",
      metadata: { name: "hello" },
      ipAddress: "127.0.0.1" });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { name: "hello" },
        ipAddress: "127.0.0.1" }));
  });

  it("stores userImage when provided", async () => {
    mocks.db.query.users.findFirst.mockResolvedValue({ role: "USER" });

    await logAudit({
      userId: "u1",
      userName: "Test",
      userImage: "https://example.com/avatar.png",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1" });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userImage: "https://example.com/avatar.png" }));
  });

  it("omits undefined optional fields", async () => {
    mocks.db.query.users.findFirst.mockResolvedValue({ role: "USER" });

    await logAudit({
      userId: "u1",
      userName: "Test",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1" });

    const data = mocks.insertValues.mock.calls[0][0];
    expect(data.userImage).toBeUndefined();
    expect(data.ipAddress).toBeUndefined();
    expect(data.metadata).toBeUndefined();
  });
});
