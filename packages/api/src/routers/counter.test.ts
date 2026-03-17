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
import { counterRouter } from "./counter";

const createCaller = t.createCallerFactory(counterRouter);

const BC = { id: "bc-1", userId: "user-1", enabled: true, twitchUserId: "tid" };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("counterRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns counters for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchCounters.findMany.mockResolvedValue([{ id: "c-1", name: "deaths", value: 5 }]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });

    it("throws PRECONDITION_FAILED when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("create", () => {
    it("creates a counter and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue(null);
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "c-1", name: "deaths" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.create({ name: "deaths" });
      expect(result.id).toBe("c-1");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("counter:updated", expect.objectContaining({ counterName: "deaths" }));
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "counter.create" }));
    });

    it("rejects duplicate counter names", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: "existing" });
      await expect(caller.create({ name: "deaths" })).rejects.toThrow("already exists");
    });
  });

  describe("update", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("updates counter value and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: UUID, name: "deaths", botChannelId: "bc-1" });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: UUID, name: "deaths", value: 10 }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.update({ id: UUID, value: 10 });
      expect(result.value).toBe(10);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "counter.update" }));
    });

    it("throws NOT_FOUND for missing counter", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue(null);
      await expect(caller.update({ id: UUID, value: 10 })).rejects.toThrow("Counter not found");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes a counter and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: UUID, name: "deaths", botChannelId: "bc-1" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);

      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "counter.delete" })
      );
    });

    it("throws NOT_FOUND for counter from different channel", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: UUID, name: "deaths", botChannelId: "other-bc" });
      await expect(caller.delete({ id: UUID })).rejects.toThrow("Counter not found");
    });
  });
});
