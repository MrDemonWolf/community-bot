import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

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
  const chainProxy = (): any => {
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
      transaction: vi.fn(async (fn: any) => fn({
        insert: vi.fn(() => chainProxy()),
        update: vi.fn(() => chainProxy()),
        delete: vi.fn(() => chainProxy()),
        select: vi.fn(() => chainProxy()),
        execute: vi.fn(),
      })),
    },
    eventBus: { publish: vi.fn() },
    logAudit: vi.fn(),
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
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { userManagementRouter } from "./userManagement";

const createCaller = t.createCallerFactory(userManagementRouter);

function adminCaller(userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role: "BROADCASTER" }));
  return createCaller(mockSession(userId));
}

describe("userManagementRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns paginated users", async () => {
      const caller = adminCaller();
      mocks.db.query.users.findMany.mockResolvedValue([{ ...mockUser(), accounts: [], createdAt: new Date("2024-01-01") }]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 1 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      const result = await caller.list();
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("rejects non-broadcaster users", async () => {
      mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ role: "MODERATOR" }));
      const caller = createCaller(mockSession());
      await expect(caller.list()).rejects.toThrow();
    });
  });

  describe("updateRole", () => {
    it("updates a user's role", async () => {
      const caller = adminCaller();
      // First call: middleware check, second: target user lookup
      mocks.db.query.users.findFirst
        .mockResolvedValueOnce(mockUser({ role: "BROADCASTER" }))
        .mockResolvedValueOnce(mockUser({ id: "user-2", role: "MODERATOR" }));
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUser({ id: "user-2", role: "LEAD_MODERATOR" })]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.updateRole({ userId: "user-2", role: "LEAD_MODERATOR" });
      expect(result).toBeTruthy();
      expect(mocks.db.update).toHaveBeenCalled();
    });
  });

  describe("ban", () => {
    it("bans a user", async () => {
      const caller = adminCaller();
      mocks.db.query.users.findFirst
        .mockResolvedValueOnce(mockUser({ role: "BROADCASTER" }))
        .mockResolvedValueOnce(mockUser({ id: "user-2", role: "USER" }));
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mocks.db.update.mockReturnValue(updateChain);
      const delChain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(delChain);
      const result = await caller.ban({ userId: "user-2", reason: "Spam" });
      expect(result.success).toBe(true);
    });
  });
});
