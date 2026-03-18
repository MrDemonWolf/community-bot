import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const chainProxy = (): any => {
    const fns: Record<string, any> = {};
    const p: any = new Proxy({} as any, {
      get(_: any, prop: string) {
        if (prop === "then") return undefined;
        if (!fns[prop]) fns[prop] = vi.fn().mockReturnValue(p);
        return fns[prop];
      },
    });
    return p;
  };
  return {
    db: {
      query: {
        systemConfigs: { findFirst: vi.fn() },
      },
      select: vi.fn(() => chainProxy()),
      delete: vi.fn(() => chainProxy()),
    },
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
vi.mock("../../utils/logger.js", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import cleanupInactiveAccounts from "./cleanupInactiveAccounts.js";

describe("cleanupInactiveAccounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes inactive accounts", async () => {
    mocks.db.query.systemConfigs.findFirst.mockResolvedValue({ value: "broadcaster-1" });

    // First select: usersWithRecentSessions (subquery, not awaited)
    const sessionsChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue("subquery") }) };
    // Second select: inactiveUsers (awaited)
    const usersChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]) }) };
    mocks.db.select.mockReturnValueOnce(sessionsChain).mockReturnValueOnce(usersChain);

    const delChain = { where: vi.fn().mockResolvedValue(undefined) };
    mocks.db.delete.mockReturnValue(delChain);

    await cleanupInactiveAccounts();
    expect(mocks.db.delete).toHaveBeenCalled();
  });

  it("does nothing when no inactive accounts", async () => {
    mocks.db.query.systemConfigs.findFirst.mockResolvedValue({ value: "broadcaster-1" });

    const sessionsChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue("subquery") }) };
    const usersChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
    mocks.db.select.mockReturnValueOnce(sessionsChain).mockReturnValueOnce(usersChain);

    await cleanupInactiveAccounts();
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });
});
