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
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { songRequestRouter } from "./songRequest";

const createCaller = t.createCallerFactory(songRequestRouter);

const BC = { id: "bc-1", userId: "user-1", enabled: true };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("songRequestRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns song requests for the user's channel", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.songRequests.findMany.mockResolvedValue([
        { id: "sr-1", title: "Song A", position: 1, requestedBy: "user1" },
      ]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });

    it("throws when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("skip", () => {
    it("skips the current song", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.songRequests.findFirst.mockResolvedValue({ id: "sr-1", title: "Song A", position: 1 });
      // skip uses db.transaction
      const txChain = (): any => {
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
      mocks.db.transaction.mockImplementation(async (fn: any) => fn({
        delete: vi.fn(() => txChain()),
        execute: vi.fn().mockResolvedValue(undefined),
      }));
      const result = await caller.skip();
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "song-request.skip" }));
    });
  });

  describe("remove", () => {
    it("removes a song by position", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.songRequests.findFirst.mockResolvedValue({ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", title: "Song B", position: 2, botChannelId: "bc-1" });
      const txChain2 = (): any => {
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
      mocks.db.transaction.mockImplementation(async (fn: any) => fn({
        delete: vi.fn(() => txChain2()),
        execute: vi.fn().mockResolvedValue(undefined),
      }));
      const result = await caller.remove({ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });
      expect(result.success).toBe(true);
    });
  });

  describe("clear", () => {
    it("clears all song requests", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      const result = await caller.clear();
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "song-request.clear" }));
    });
  });

  describe("getSettings", () => {
    it("returns song request settings", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5, minAccessLevel: "EVERYONE",
      });
      const result = await caller.getSettings();
      expect(result).toBeTruthy();
      expect(result!.enabled).toBe(true);
    });
  });

  describe("updateSettings", () => {
    it("updates song request settings", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ enabled: true, maxQueueSize: 100 }]),
          }),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.updateSettings({ maxQueueSize: 100 });
      expect(result).toBeTruthy();
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "song-request.settings-update" }));
    });
  });
});
