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
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { setupRouter } from "./setup";

const createCaller = t.createCallerFactory(setupRouter);

describe("setupRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("status", () => {
    it("returns incomplete when no setup config", async () => {
      const caller = createCaller({});
      mocks.db.query.systemConfigs.findFirst.mockResolvedValue(null);
      const result = await caller.status();
      expect(result.setupComplete).toBe(false);
    });

    it("returns complete when setup is done", async () => {
      const caller = createCaller({});
      mocks.db.query.systemConfigs.findFirst.mockResolvedValue({ key: "setupComplete", value: "true" });
      const result = await caller.status();
      expect(result.setupComplete).toBe(true);
    });
  });

  describe("saveStep", () => {
    it("saves a step to system config", async () => {
      const caller = createCaller(mockSession());
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.saveStep({ step: "authorize" });
      expect(result.success).toBe(true);
    });
  });

  describe("complete", () => {
    it("completes setup with valid token", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.systemConfigs.findFirst.mockResolvedValue({ key: "setupToken", value: "valid-token" });

      // The transaction mock needs to handle the nested operations
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
      mocks.db.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          insert: vi.fn(() => txChain()),
          update: vi.fn(() => txChain()),
          delete: vi.fn(() => txChain()),
        };
        return fn(tx);
      });

      // After transaction, auto-enable bot
      mocks.db.query.accounts.findFirst.mockResolvedValue({ accountId: "twitch-id" });
      mocks.db.query.users.findFirst.mockResolvedValue({ name: "broadcaster" });
      const insertChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "bc-1", twitchUserId: "twitch-id", twitchUsername: "broadcaster" }]),
          }),
        }),
      };
      mocks.db.insert.mockReturnValue(insertChain);

      const result = await caller.complete({ token: "valid-token" });
      expect(result.success).toBe(true);
    });

    it("throws FORBIDDEN with invalid token", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.systemConfigs.findFirst.mockResolvedValue({ key: "setupToken", value: "other-token" });
      await expect(caller.complete({ token: "wrong" })).rejects.toThrow("Invalid setup token");
    });

    it("throws FORBIDDEN when no token exists", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.systemConfigs.findFirst.mockResolvedValue(null);
      await expect(caller.complete({ token: "any" })).rejects.toThrow("Invalid setup token");
    });
  });
});
