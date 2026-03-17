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
        botChannels: { findFirst: vi.fn() },
        twitchCounters: { findFirst: vi.fn() },
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

import { counter } from "./counter.js";

function makeMockMsg(isMod = true) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("counter command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("does nothing if user is not a mod", async () => {
    await counter.execute(client, "#channel", "user", ["deaths", "create"], makeMockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage when no name given", async () => {
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    await counter.execute(client, "#channel", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("!counter"));
  });

  it("says not configured when no bot channel", async () => {
    mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
    await counter.execute(client, "#channel", "user", ["deaths"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("not configured"));
  });

  describe("with bot channel", () => {
    beforeEach(() => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    });

    it("creates a counter", async () => {
      const chain = { values: vi.fn().mockResolvedValue(undefined) };
      mocks.db.insert.mockReturnValue(chain);
      await counter.execute(client, "#channel", "user", ["deaths", "create"], makeMockMsg());
      expect(mocks.db.insert).toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("deaths"));
    });

    it("shows counter value", async () => {
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ name: "deaths", value: 42 });
      await counter.execute(client, "#channel", "user", ["deaths"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("42"));
    });

    it("increments counter with +", async () => {
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: "c-1", name: "deaths", value: 5 });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ name: "deaths", value: 6 }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      await counter.execute(client, "#channel", "user", ["deaths", "+"], makeMockMsg());
      expect(mocks.db.update).toHaveBeenCalled();
    });

    it("decrements counter with -", async () => {
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: "c-1", name: "deaths", value: 5 });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ name: "deaths", value: 4 }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      await counter.execute(client, "#channel", "user", ["deaths", "-"], makeMockMsg());
      expect(mocks.db.update).toHaveBeenCalled();
    });

    it("sets counter with set", async () => {
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: "c-1", name: "deaths", value: 5 });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ name: "deaths", value: 100 }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      await counter.execute(client, "#channel", "user", ["deaths", "set", "100"], makeMockMsg());
      expect(mocks.db.update).toHaveBeenCalled();
    });

    it("deletes a counter", async () => {
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue({ id: "c-1", name: "deaths" });
      const chain = { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "c-1", name: "deaths" }]) }) };
      mocks.db.delete.mockReturnValue(chain);
      await counter.execute(client, "#channel", "user", ["deaths", "delete"], makeMockMsg());
      expect(mocks.db.delete).toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("deleted"));
    });

    it("says not found for missing counter", async () => {
      mocks.db.query.twitchCounters.findFirst.mockResolvedValue(null);
      await counter.execute(client, "#channel", "user", ["missing"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("does not exist"));
    });
  });
});
