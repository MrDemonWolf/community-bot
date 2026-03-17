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
import { timerRouter } from "./timer";

const createCaller = t.createCallerFactory(timerRouter);

const BC = { id: "bc-1", userId: "user-1", enabled: true };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("timerRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns timers for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchTimers.findMany.mockResolvedValue([{ id: "t-1", name: "promo", enabled: true }]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });

    it("throws when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("create", () => {
    it("creates a timer and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchTimers.findFirst.mockResolvedValue(null);
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "t-1", name: "promo" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.create({ name: "promo", message: "Follow!", onlineIntervalSeconds: 300 });
      expect(result.id).toBe("t-1");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("timer:updated", expect.any(Object));
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "timer.create" }));
    });
  });

  describe("update", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("updates a timer and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchTimers.findFirst.mockResolvedValue({ id: UUID, name: "promo", botChannelId: "bc-1" });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: UUID, name: "promo" }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.update({ id: UUID, message: "Updated!" });
      expect(result).toBeTruthy();
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "timer.update" }));
    });

    it("throws NOT_FOUND for missing timer", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchTimers.findFirst.mockResolvedValue(null);
      await expect(caller.update({ id: UUID, message: "test" })).rejects.toThrow("Timer not found");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes a timer and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchTimers.findFirst.mockResolvedValue({ id: UUID, name: "promo", botChannelId: "bc-1" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "timer.delete" }));
    });
  });

  describe("toggleEnabled", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("toggles timer enabled state", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchTimers.findFirst.mockResolvedValue({ id: UUID, name: "promo", botChannelId: "bc-1", enabled: true });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: UUID, enabled: false }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.toggleEnabled({ id: UUID });
      expect(result.enabled).toBe(false);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "timer.toggle" }));
    });
  });
});
