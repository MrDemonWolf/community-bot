import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const chainProxy = (): any => {
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
  return {
    db: {
      query: {
        giveaways: { findFirst: vi.fn() },
        giveawayEntries: { findFirst: vi.fn() },
      },
      insert: vi.fn(() => chainProxy()),
      update: vi.fn(() => chainProxy()),
      delete: vi.fn(() => chainProxy()),
      select: vi.fn(() => chainProxy()),
    },
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

import {
  startGiveaway,
  addEntry,
  drawWinner,
  endGiveaway,
  getEntryCount,
} from "./giveawayManager.js";

describe("giveawayManager", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("startGiveaway", () => {
    it("deactivates existing giveaways and creates a new one", async () => {
      // db.update(giveaways).set({isActive: false}).where(...)
      const updateChain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(updateChain);
      // db.insert(giveaways).values(...).returning()
      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "ga-1", keyword: "win", title: "Giveaway", isActive: true }]),
        }),
      };
      mocks.db.insert.mockReturnValue(insertChain);

      const result = await startGiveaway("bc-1", "win", "Giveaway");
      expect(result).toBeTruthy();
      expect(result.id).toBe("ga-1");
      expect(mocks.db.update).toHaveBeenCalled();
      expect(mocks.db.insert).toHaveBeenCalled();
    });
  });

  describe("addEntry", () => {
    it("adds an entry when giveaway is active", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1", keyword: "win" });
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "entry-1", twitchUsername: "viewer1" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);

      const result = await addEntry("bc-1", "viewer1", "uid-1");
      expect(result).toBeTruthy();
    });

    it("returns null when no active giveaway", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue(null);
      const result = await addEntry("bc-1", "viewer1", "uid-1");
      expect(result).toBeNull();
    });

    it("returns null when message doesn't match keyword", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1", keyword: "win" });
      const result = await addEntry("bc-1", "viewer1", "uid-1", "lose");
      expect(result).toBeNull();
    });
  });

  describe("drawWinner", () => {
    it("picks a random winner and updates the giveaway", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue({
        id: "ga-1",
        entries: [
          { twitchUsername: "viewer1", twitchUserId: "uid-1" },
          { twitchUsername: "viewer2", twitchUserId: "uid-2" },
        ] });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);

      const winner = await drawWinner("bc-1");

      expect(winner).toBeTruthy();
      expect(["viewer1", "viewer2"]).toContain(winner);
      expect(mocks.db.update).toHaveBeenCalled();
    });

    it("returns null when no active giveaway", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue(null);
      const winner = await drawWinner("bc-1");
      expect(winner).toBeNull();
    });

    it("returns null when giveaway has no entries", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue({
        id: "ga-1",
        entries: [] });
      const winner = await drawWinner("bc-1");
      expect(winner).toBeNull();
    });
  });

  describe("endGiveaway", () => {
    it("deactivates the active giveaway", async () => {
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "ga-1" }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);

      const result = await endGiveaway("bc-1");
      expect(result.count).toBe(1);
      expect(mocks.db.update).toHaveBeenCalled();
    });
  });

  describe("getEntryCount", () => {
    it("returns the entry count for the active giveaway", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue({ id: "ga-1" });
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 15 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);

      const count = await getEntryCount("bc-1");
      expect(count).toBe(15);
    });

    it("returns 0 when no active giveaway", async () => {
      mocks.db.query.giveaways.findFirst.mockResolvedValue(null);
      const count = await getEntryCount("bc-1");
      expect(count).toBe(0);
    });
  });
});
