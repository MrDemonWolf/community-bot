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
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { queueRouter } from "./queue";

const createCaller = t.createCallerFactory(queueRouter);

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("queueRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getState", () => {
    it("returns queue state via upsert", async () => {
      const caller = createCaller(mockSession());
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "singleton", status: "CLOSED" }]),
          }),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.getState();
      expect(result).toBeTruthy();
      expect(result.status).toBe("CLOSED");
    });
  });

  describe("list", () => {
    it("returns queue entries", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.queueEntries.findMany.mockResolvedValue([
        { id: "qe-1", twitchUsername: "viewer1", position: 1 },
      ]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });
  });

  describe("setStatus", () => {
    it("sets queue to OPEN", async () => {
      const caller = authedCaller();
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "singleton", status: "OPEN" }]),
          }),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.setStatus({ status: "OPEN" });
      expect(result.status).toBe("OPEN");
      expect(mocks.logAudit).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("clears the queue", async () => {
      const caller = authedCaller();
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 3 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      mocks.db.delete.mockReturnValue({ then: undefined } as any);
      // db.delete(queueEntries) - returns a promise directly
      const delMock = vi.fn().mockResolvedValue(undefined);
      mocks.db.delete.mockReturnValue(delMock);
      // Actually it's db.delete(queueEntries) with no .where() - it returns a thenable
      mocks.db.delete.mockResolvedValue(undefined);
      const result = await caller.clear();
      expect(result.success).toBe(true);
    });
  });
});
