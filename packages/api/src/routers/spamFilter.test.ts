import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be inside vi.hoisted() so vi.mock() factories can use
// them. Inline Drizzle-compatible mock: 3-level query proxy + chain proxy.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  /** Returns a self-chaining proxy. Each property access returns another
   *  chain proxy so Drizzle-style `db.insert(t).values({}).returning()` works. */
  function makeChain(): any {
    const cache: Record<string, any> = {};
    return new Proxy({} as any, {
      get(_, prop: string) {
        if (prop === "then") return undefined; // not a thenable
        if (!cache[prop]) cache[prop] = vi.fn().mockReturnValue(makeChain());
        return cache[prop];
      },
    });
  }

  /** 3-level proxy: db.query.<model>.<method> → vi.fn() */
  const models: Record<string, any> = {};
  const queryProxy = new Proxy({} as any, {
    get(_, model: string) {
      if (!models[model]) {
        const fns: Record<string, any> = {};
        models[model] = new Proxy({} as any, {
          get(__, method: string) {
            if (!fns[method]) fns[method] = vi.fn();
            return fns[method];
          },
        });
      }
      return models[model];
    },
  });

  const db: any = {
    query: queryProxy,
    insert: vi.fn().mockImplementation(makeChain),
    update: vi.fn().mockImplementation(makeChain),
    delete: vi.fn().mockImplementation(makeChain),
    select: vi.fn().mockImplementation(makeChain),
    execute: vi.fn(),
  };

  return { db, eventBus: { publish: vi.fn() }, logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  eq: vi.fn(),
  and: vi.fn(),
  spamFilters: {},
  botChannels: {},
  users: {},
}));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { spamFilterRouter } from "./spamFilter";

const createCaller = t.createCallerFactory(spamFilterRouter);
const q = mocks.db.query;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  q.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

function mockBotChannel() {
  q.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
}

const FULL_FILTER = {
  capsEnabled: true,
  capsMinLength: 15,
  capsMaxPercent: 70,
  linksEnabled: false,
  linksAllowSubs: true,
  linksAllowlist: [] as string[],
  symbolsEnabled: false,
  symbolsMaxPercent: 50,
  emotesEnabled: false,
  emotesMaxCount: 15,
  repetitionEnabled: false,
  repetitionMaxRepeat: 10,
  bannedWordsEnabled: false,
  bannedWords: [] as string[],
  exemptLevel: "SUBSCRIBER",
  timeoutDuration: 5,
  warningMessage: "Don't spam.",
};

describe("spamFilterRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("get", () => {
    it("returns existing filter config", async () => {
      const caller = createCaller(mockSession());
      mockBotChannel();
      q.spamFilters.findFirst.mockResolvedValue({ ...FULL_FILTER, capsEnabled: true });

      const result = await caller.get();
      expect(result.capsEnabled).toBe(true);
    });

    it("returns defaults when no filter exists", async () => {
      const caller = createCaller(mockSession());
      mockBotChannel();
      q.spamFilters.findFirst.mockResolvedValue(null);

      const result = await caller.get();
      expect(result.capsEnabled).toBe(false);
      expect(result.timeoutDuration).toBe(5);
    });

    it("includes linksAllowlist as empty array in defaults", async () => {
      const caller = createCaller(mockSession());
      mockBotChannel();
      q.spamFilters.findFirst.mockResolvedValue(null);

      const result = await caller.get();
      expect(result.linksAllowlist).toEqual([]);
    });

    it("returns linksAllowlist from stored filter", async () => {
      const caller = createCaller(mockSession());
      mockBotChannel();
      q.spamFilters.findFirst.mockResolvedValue({
        ...FULL_FILTER,
        linksEnabled: true,
        linksAllowlist: ["twitch.tv", "youtube.com"],
      });

      const result = await caller.get();
      expect(result.linksAllowlist).toEqual(["twitch.tv", "youtube.com"]);
    });
  });

  describe("update", () => {
    it("upserts filter config and publishes event", async () => {
      const caller = authedCaller();
      mockBotChannel();

      const upsertResult = { id: "sf-1", capsEnabled: true, linksEnabled: true };
      // db.insert().values().onConflictDoUpdate().returning() → resolves to [result]
      mocks.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([upsertResult]),
          }),
        }),
      });

      const result = await caller.update({ capsEnabled: true, linksEnabled: true });

      expect(result.capsEnabled).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("spam-filter:updated", { channelId: "bc-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "spam-filter.update" })
      );
    });

    it("updates banned words", async () => {
      const caller = authedCaller();
      mockBotChannel();

      const upsertResult = { id: "sf-1", bannedWordsEnabled: true, bannedWords: ["bad", "spam"] };
      mocks.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([upsertResult]),
          }),
        }),
      });

      const result = await caller.update({ bannedWordsEnabled: true, bannedWords: ["bad", "spam"] });
      expect(result.bannedWords).toEqual(["bad", "spam"]);
    });

    it("updates linksAllowlist", async () => {
      const caller = authedCaller();
      mockBotChannel();

      const upsertResult = { id: "sf-1", linksEnabled: true, linksAllowlist: ["twitch.tv", "youtube.com"] };
      mocks.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([upsertResult]),
          }),
        }),
      });

      const result = await caller.update({ linksEnabled: true, linksAllowlist: ["twitch.tv", "youtube.com"] });
      expect(result.linksAllowlist).toEqual(["twitch.tv", "youtube.com"]);
    });

    it("rejects linksAllowlist entries that are too long", async () => {
      const caller = authedCaller();
      mockBotChannel();
      const longEntry = "a".repeat(201);
      await expect(caller.update({ linksAllowlist: [longEntry] })).rejects.toThrow();
    });

    it("rejects linksAllowlist with more than 100 entries", async () => {
      const caller = authedCaller();
      mockBotChannel();
      const tooMany = Array.from({ length: 101 }, (_, i) => `domain${i}.com`);
      await expect(caller.update({ linksAllowlist: tooMany })).rejects.toThrow();
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.update({ capsEnabled: true })).rejects.toThrow();
    });

    it("validates timeout duration range", async () => {
      const caller = authedCaller();
      mockBotChannel();
      await expect(caller.update({ timeoutDuration: 0 })).rejects.toThrow();
    });
  });
});
