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
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { userRouter } from "./user";

const createCaller = t.createCallerFactory(userRouter);

describe("userRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getProfile", () => {
    it("returns the current user profile", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ ...mockUser(), accounts: [] });
      const result = await caller.getProfile();
      expect(result).toBeTruthy();
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.getProfile()).rejects.toThrow("Authentication required");
    });
  });

  describe("exportData", () => {
    it("returns exported user data", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.users.findFirst.mockResolvedValue({ ...mockUser(), accounts: [] });
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      mocks.db.query.twitchChatCommands.findMany.mockResolvedValue([]);
      mocks.db.query.regulars.findMany.mockResolvedValue([]);
      mocks.db.query.quotes.findMany.mockResolvedValue([]);
      mocks.db.query.twitchCounters.findMany.mockResolvedValue([]);
      mocks.db.query.twitchTimers.findMany.mockResolvedValue([]);
      const result = await caller.exportData();
      expect(result).toBeTruthy();
    });
  });
});
