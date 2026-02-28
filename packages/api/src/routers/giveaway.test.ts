import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return { prisma: new Proxy(mp, handler), eventBus: { publish: vi.fn() }, logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { giveawayRouter } from "./giveaway";

const createCaller = t.createCallerFactory(giveawayRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("giveawayRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns giveaways with entry counts", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
      p.giveaway.findMany.mockResolvedValue([
        {
          id: "ga-1",
          title: "Big Giveaway",
          keyword: "enter",
          isActive: true,
          winnerName: null,
          createdAt: new Date("2025-01-01"),
          _count: { entries: 10 },
        },
        {
          id: "ga-2",
          title: "Old Giveaway",
          keyword: "win",
          isActive: false,
          winnerName: "winner1",
          createdAt: new Date("2024-12-01"),
          _count: { entries: 25 },
        },
      ]);

      const result = await caller.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "ga-1",
        title: "Big Giveaway",
        keyword: "enter",
        isActive: true,
        winnerName: null,
        entryCount: 10,
        createdAt: "2025-01-01T00:00:00.000Z",
      });
      expect(result[1].entryCount).toBe(25);
    });

    it("throws when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("create", () => {
    it("creates a giveaway and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
      p.giveaway.updateMany.mockResolvedValue({ count: 0 });
      p.giveaway.create.mockResolvedValue({
        id: "ga-new",
        botChannelId: "bc-1",
        title: "New Giveaway",
        keyword: "enter",
        isActive: true,
      });

      const result = await caller.create({ title: "New Giveaway", keyword: "ENTER" });

      expect(result.id).toBe("ga-new");
      expect(p.giveaway.updateMany).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1", isActive: true },
        data: { isActive: false },
      });
      expect(p.giveaway.create).toHaveBeenCalledWith({
        data: {
          botChannelId: "bc-1",
          title: "New Giveaway",
          keyword: "enter",
        },
      });
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("giveaway:started", {
        giveawayId: "ga-new",
        channelId: "tw-1",
      });
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
    it("draws a winner and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
      p.giveaway.findFirst.mockResolvedValue({
        id: "ga-1",
        entries: [
          { twitchUsername: "viewer1", twitchUserId: "uid-1" },
          { twitchUsername: "viewer2", twitchUserId: "uid-2" },
        ],
      });
      p.giveaway.update.mockResolvedValue({});

      const result = await caller.draw();

      expect(["viewer1", "viewer2"]).toContain(result.winner);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("giveaway:winner", {
        giveawayId: "ga-1",
        channelId: "tw-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "giveaway.draw" })
      );
    });

    it("throws when no entries", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
      p.giveaway.findFirst.mockResolvedValue(null);

      await expect(caller.draw()).rejects.toThrow("No active giveaway or no entries");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.draw()).rejects.toThrow();
    });
  });

  describe("end", () => {
    it("ends giveaway and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
      p.giveaway.findFirst.mockResolvedValue({ id: "ga-1", isActive: true });
      p.giveaway.update.mockResolvedValue({});

      const result = await caller.end();

      expect(result.success).toBe(true);
      expect(p.giveaway.update).toHaveBeenCalledWith({
        where: { id: "ga-1" },
        data: { isActive: false },
      });
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("giveaway:ended", {
        giveawayId: "ga-1",
        channelId: "tw-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "giveaway.end" })
      );
    });

    it("throws when no active giveaway", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tw-1" });
      p.giveaway.findFirst.mockResolvedValue(null);

      await expect(caller.end()).rejects.toThrow("No active giveaway");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.end()).rejects.toThrow();
    });
  });
});
