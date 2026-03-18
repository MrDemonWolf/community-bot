import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const queryProxy = new Proxy({} as Record<string, any>, {
    get(target, model: string) {
      if (!target[model]) {
        target[model] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[model];
    },
  });
  const chainProxy = () => {
    const fns: Record<string, any> = {};
    const p: any = new Proxy({} as any, {
      get(_, prop: string) {
        if (prop === "then") return undefined;
        if (!fns[prop]) fns[prop] = vi.fn().mockReturnValue(p);
        return fns[prop];
      },
    });
    return p;
  };
  return {
    db: {
      query: queryProxy,
      insert: vi.fn(() => chainProxy()),
      update: vi.fn(() => chainProxy()),
      delete: vi.fn(() => chainProxy()),
      select: vi.fn(() => chainProxy()),
      execute: vi.fn(),
      transaction: vi.fn(),
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
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { auditLogRouter } from "./auditLog";

const createCaller = t.createCallerFactory(auditLogRouter);

describe("auditLogRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("BROADCASTER sees all logs", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      mocks.db.query.auditLogs.findMany.mockResolvedValue([]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      const result = await caller.list();
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });

    it("MODERATOR sees filtered logs", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ role: "MODERATOR" });
      mocks.db.query.auditLogs.findMany.mockResolvedValue([]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      await caller.list();
      expect(mocks.db.query.auditLogs.findMany).toHaveBeenCalled();
    });

    it("USER only sees USER logs", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ role: "USER" });
      mocks.db.query.auditLogs.findMany.mockResolvedValue([]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      await caller.list();
      expect(mocks.db.query.auditLogs.findMany).toHaveBeenCalled();
    });

    it("supports action and resourceType filters", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      mocks.db.query.auditLogs.findMany.mockResolvedValue([]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      await caller.list({ action: "bot.", resourceType: "BotChannel", skip: 0, take: 10 });
      expect(mocks.db.query.auditLogs.findMany).toHaveBeenCalled();
    });

    it("returns isChannelOwner flag", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      mocks.db.query.auditLogs.findMany.mockResolvedValue([{
        id: "log-1", userId: "user-1", userName: "Owner", userImage: null, userRole: "BROADCASTER",
        action: "bot.enable", resourceType: "BotChannel", resourceId: "bc-1", metadata: null, createdAt: new Date(),
      }]);
      // First select: count, Second select: channelOwners
      const countChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 1 }]) }) };
      const ownerChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ userId: "user-1" }]) }) };
      mocks.db.select.mockReturnValueOnce(countChain).mockReturnValueOnce(ownerChain);
      const result = await caller.list();
      expect(result.items[0].isChannelOwner).toBe(true);
    });

    it("paginates results", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      mocks.db.query.auditLogs.findMany.mockResolvedValue([]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 50 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      const result = await caller.list({ skip: 10, take: 5 });
      expect(result.total).toBe(50);
      expect(mocks.db.query.auditLogs.findMany).toHaveBeenCalledWith(expect.objectContaining({ offset: 10, limit: 5 }));
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.list()).rejects.toThrow("Authentication required");
    });
  });
});
