import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be inside vi.hoisted() so vi.mock() factories can use
// them. We inline the createMockDb logic here because test-helpers can't be
// imported before hoisting.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  /** Returns a self-chaining proxy. Each property access returns another
   *  chain proxy so Drizzle-style `db.update(t).set({}).where()` never throws. */
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
  desc: vi.fn(),
  count: vi.fn(),
  giveaways: {},
  giveawayEntries: {},
  botChannels: {},
  users: {},
}));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { giveawayRouter } from "./giveaway";

const createCaller = t.createCallerFactory(giveawayRouter);
const q = mocks.db.query;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  q.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

function mockBotChannel() {
  q.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
}

describe("giveawayRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns giveaways with entry counts", async () => {
      const caller = createCaller(mockSession());
      mockBotChannel();

      q.giveaways.findMany.mockResolvedValue([
        { id: "ga-1", title: "Big Giveaway", keyword: "enter", isActive: true, winnerName: null, createdAt: new Date("2025-01-01") },
        { id: "ga-2", title: "Old Giveaway", keyword: "win", isActive: false, winnerName: "winner1", createdAt: new Date("2024-12-01") },
      ]);

      // Mock db.select().from().where() for entry counts
      const mockWhere = vi.fn()
        .mockResolvedValueOnce([{ value: 10 }])
        .mockResolvedValueOnce([{ value: 25 }]);
      mocks.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

      const result = await caller.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "ga-1", title: "Big Giveaway", entryCount: 10, isActive: true });
      expect(result[1]).toMatchObject({ id: "ga-2", entryCount: 25, winnerName: "winner1" });
    });

    it("returns empty entry count when select returns nothing", async () => {
      const caller = createCaller(mockSession());
      mockBotChannel();
      q.giveaways.findMany.mockResolvedValue([
        { id: "ga-1", title: "New", keyword: "go", isActive: true, winnerName: null, createdAt: new Date("2025-01-01") },
      ]);
      mocks.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });

      const result = await caller.list();
      expect(result[0]?.entryCount).toBe(0);
    });

    it("throws when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      q.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("create", () => {
    it("creates a giveaway, lowercases keyword, and publishes event", async () => {
      const caller = authedCaller();
      mockBotChannel();

      const newGiveaway = { id: "ga-new", botChannelId: "bc-1", title: "New Giveaway", keyword: "enter", isActive: true };
      mocks.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newGiveaway]),
        }),
      });

      const result = await caller.create({ title: "New Giveaway", keyword: "ENTER" });

      expect(result.id).toBe("ga-new");
      expect(result.keyword).toBe("enter");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("giveaway:started", {
        giveawayId: "ga-new",
        channelId: "tw-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "giveaway.create" })
      );
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.create({ title: "test", keyword: "enter" })).rejects.toThrow();
    });
  });

  describe("draw", () => {
    it("picks a random winner from entries and publishes event", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue({
        id: "ga-1",
        entries: [
          { twitchUsername: "viewer1", twitchUserId: "uid-1" },
          { twitchUsername: "viewer2", twitchUserId: "uid-2" },
        ],
      });

      const result = await caller.draw();

      expect(["viewer1", "viewer2"]).toContain(result.winner);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("giveaway:winner", {
        giveawayId: "ga-1",
        channelId: "tw-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "giveaway.draw" })
      );
    });

    it("throws PRECONDITION_FAILED when no active giveaway", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue(null);
      await expect(caller.draw()).rejects.toThrow("No active giveaway or no entries");
    });

    it("throws PRECONDITION_FAILED when giveaway has no entries", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue({ id: "ga-1", entries: [] });
      await expect(caller.draw()).rejects.toThrow("No active giveaway or no entries");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.draw()).rejects.toThrow();
    });
  });

  describe("end", () => {
    it("ends the active giveaway and publishes event", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue({ id: "ga-1", isActive: true });

      const result = await caller.end();

      expect(result.success).toBe(true);
      expect(mocks.db.update).toHaveBeenCalled();
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("giveaway:ended", {
        giveawayId: "ga-1",
        channelId: "tw-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "giveaway.end" })
      );
    });

    it("throws PRECONDITION_FAILED when no active giveaway", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue(null);
      await expect(caller.end()).rejects.toThrow("No active giveaway");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.end()).rejects.toThrow();
    });
  });

  describe("delete", () => {
    const VALID_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes a past giveaway and audit-logs", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue({
        id: VALID_ID,
        botChannelId: "bc-1",
        title: "Old Giveaway",
        isActive: false,
      });

      const result = await caller.delete({ id: VALID_ID });

      expect(result.success).toBe(true);
      expect(mocks.db.delete).toHaveBeenCalled();
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "giveaway.delete" })
      );
    });

    it("throws NOT_FOUND when giveaway does not exist", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue(null);
      await expect(caller.delete({ id: VALID_ID })).rejects.toThrow("Giveaway not found");
    });

    it("throws NOT_FOUND when giveaway belongs to a different channel", async () => {
      const caller = authedCaller();
      mockBotChannel();
      q.giveaways.findFirst.mockResolvedValue({
        id: VALID_ID,
        botChannelId: "bc-DIFFERENT",
        title: "Not mine",
        isActive: false,
      });
      await expect(caller.delete({ id: VALID_ID })).rejects.toThrow("Giveaway not found");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.delete({ id: VALID_ID })).rejects.toThrow();
    });

    it("rejects an invalid UUID", async () => {
      const caller = authedCaller();
      await expect(caller.delete({ id: "not-a-uuid" })).rejects.toThrow();
    });
  });
});
