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
    getTwitchUserByLogin: vi.fn(),
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
  twitchChatCommands: {}, regulars: {}, twitchCounters: {},
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
vi.mock("../utils/twitch", () => ({ getTwitchUserByLogin: mocks.getTwitchUserByLogin, getTwitchUserById: vi.fn() }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { regularRouter } from "./regular";

const createCaller = t.createCallerFactory(regularRouter);

const BC = { id: "bc-1", userId: "user-1", enabled: true, twitchUserId: "tid" };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("regularRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns all regulars", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.regulars.findMany.mockResolvedValue([{ id: "r-1", twitchUsername: "viewer1" }]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });
  });

  describe("add", () => {
    it("adds a regular and publishes event", async () => {
      const caller = authedCaller();
      mocks.getTwitchUserByLogin.mockResolvedValue({ id: "uid-1", display_name: "viewer1" });
      mocks.db.query.regulars.findFirst.mockResolvedValue(null);
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "r-1", twitchUsername: "viewer1", twitchUserId: "uid-1" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.add({ username: "viewer1" });
      expect(result).toBeTruthy();
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("regular:created", expect.any(Object));
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "regular.add" }));
    });

    it("rejects duplicate regulars", async () => {
      const caller = authedCaller();
      mocks.getTwitchUserByLogin.mockResolvedValue({ id: "uid-1", display_name: "viewer1" });
      mocks.db.query.regulars.findFirst.mockResolvedValue({ id: "existing" });
      await expect(caller.add({ username: "viewer1" })).rejects.toThrow("already a regular");
    });
  });

  describe("remove", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("removes a regular and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.regulars.findFirst.mockResolvedValue({ id: UUID, twitchUserId: "uid-1" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      const result = await caller.remove({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("regular:deleted", expect.any(Object));
    });

    it("throws NOT_FOUND for missing regular", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.regulars.findFirst.mockResolvedValue(null);
      await expect(caller.remove({ id: UUID })).rejects.toThrow("not found");
    });
  });
});
