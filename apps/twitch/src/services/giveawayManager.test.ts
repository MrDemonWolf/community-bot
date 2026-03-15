import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; } });
      }
      return target[prop];
    },
  };
  return { db: new Proxy(mp, handler) };
});

vi.mock("@community-bot/db", () => ({ db: mocks.db }));

import {
  startGiveaway,
  addEntry,
  drawWinner,
  endGiveaway,
  getEntryCount,
} from "./giveawayManager.js";

const p = mocks.db;

describe("giveawayManager", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("startGiveaway", () => {
    it("deactivates existing giveaways and creates a new one", async () => {
      p.query.giveaways.updateMany.mockResolvedValue({ count: 1 });
      p.query.giveaways.create.mockResolvedValue({
        id: "ga-1",
        botChannelId: "bc-1",
        keyword: "enter",
        title: "Big Giveaway",
        isActive: true });

      const result = await startGiveaway("bc-1", "ENTER", "Big Giveaway");

      expect(p.query.giveaways.updateMany).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1", isActive: true },
        data: { isActive: false } });
      expect(p.query.giveaways.create).toHaveBeenCalledWith({
        data: { botChannelId: "bc-1", keyword: "enter", title: "Big Giveaway" } });
      expect(result.id).toBe("ga-1");
    });
  });

  describe("addEntry", () => {
    it("creates an entry for an active giveaway", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1", keyword: "enter" });
      p.query.giveawayEntries.create.mockResolvedValue({
        id: "entry-1",
        giveawayId: "ga-1",
        twitchUsername: "viewer1",
        twitchUserId: "uid-1" });

      const result = await addEntry("bc-1", "viewer1", "uid-1");

      expect(result).not.toBeNull();
      expect(p.query.giveawayEntries.create).toHaveBeenCalledWith({
        data: {
          giveawayId: "ga-1",
          twitchUsername: "viewer1",
          twitchUserId: "uid-1",
        } });
    });

    it("returns null when no active giveaway", async () => {
      p.query.giveaways.findFirst.mockResolvedValue(null);

      const result = await addEntry("bc-1", "viewer1", "uid-1");

      expect(result).toBeNull();
      expect(p.query.giveawayEntries.create).not.toHaveBeenCalled();
    });

    it("checks keyword match when message is provided", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1", keyword: "enter" });

      const result = await addEntry("bc-1", "viewer1", "uid-1", "wrong keyword");

      expect(result).toBeNull();
      expect(p.query.giveawayEntries.create).not.toHaveBeenCalled();
    });

    it("creates entry when message matches keyword", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1", keyword: "enter" });
      p.query.giveawayEntries.create.mockResolvedValue({
        id: "entry-1",
        giveawayId: "ga-1",
        twitchUsername: "viewer1",
        twitchUserId: "uid-1" });

      const result = await addEntry("bc-1", "viewer1", "uid-1", "enter");

      expect(result).not.toBeNull();
      expect(p.query.giveawayEntries.create).toHaveBeenCalled();
    });

    it("returns null on unique constraint violation (duplicate entry)", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1", keyword: "enter" });
      p.query.giveawayEntries.create.mockRejectedValue(new Error("Unique constraint"));

      const result = await addEntry("bc-1", "viewer1", "uid-1");

      expect(result).toBeNull();
    });
  });

  describe("drawWinner", () => {
    it("picks a random winner and updates the giveaway", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({
        id: "ga-1",
        entries: [
          { twitchUsername: "viewer1", twitchUserId: "uid-1" },
          { twitchUsername: "viewer2", twitchUserId: "uid-2" },
        ] });
      p.query.giveaways.update.mockResolvedValue({});

      const winner = await drawWinner("bc-1");

      expect(winner).toBeTruthy();
      expect(["viewer1", "viewer2"]).toContain(winner);
      expect(p.query.giveaways.update).toHaveBeenCalledWith({
        where: { id: "ga-1" },
        data: { winnerName: winner } });
    });

    it("returns null when no active giveaway", async () => {
      p.query.giveaways.findFirst.mockResolvedValue(null);

      const winner = await drawWinner("bc-1");

      expect(winner).toBeNull();
    });

    it("returns null when giveaway has no entries", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({
        id: "ga-1",
        entries: [] });

      const winner = await drawWinner("bc-1");

      expect(winner).toBeNull();
    });
  });

  describe("endGiveaway", () => {
    it("deactivates the active giveaway", async () => {
      p.query.giveaways.updateMany.mockResolvedValue({ count: 1 });

      await endGiveaway("bc-1");

      expect(p.query.giveaways.updateMany).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1", isActive: true },
        data: { isActive: false } });
    });
  });

  describe("getEntryCount", () => {
    it("returns the entry count for the active giveaway", async () => {
      p.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1" });
      p.query.giveawayEntries.count.mockResolvedValue(15);

      const count = await getEntryCount("bc-1");

      expect(count).toBe(15);
      expect(p.query.giveawayEntries.count).toHaveBeenCalledWith({
        where: { giveawayId: "ga-1" } });
    });

    it("returns 0 when no active giveaway", async () => {
      p.query.giveaways.findFirst.mockResolvedValue(null);

      const count = await getEntryCount("bc-1");

      expect(count).toBe(0);
    });
  });
});
