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
    getBotChannelId: vi.fn(),
    db: {
      query: {
        quotes: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      insert: vi.fn(() => chainProxy()),
      select: vi.fn(() => chainProxy()),
      delete: vi.fn(() => chainProxy()),
    },
    getGame: vi.fn(),
  };
});

vi.mock("../services/broadcasterCache.js", () => ({
  getBotChannelId: mocks.getBotChannelId,
}));

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
vi.mock("../services/streamStatusManager.js", () => ({
  getGame: mocks.getGame }));

import { quote } from "./quote.js";

function makeMockMsg(isMod = false) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("quote command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("says no bot channel when not configured", async () => {
    mocks.getBotChannelId.mockReturnValue(undefined);
    await quote.execute(client, "#channel", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@user, bot channel not configured.");
  });

  describe("with bot channel", () => {
    beforeEach(() => {
      mocks.getBotChannelId.mockReturnValue("bc-1");
    });

    it("shows random quote", async () => {
      // Source uses db.select({value: count()}).from(quotes).where(...)
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 3 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      mocks.db.query.quotes.findMany.mockResolvedValue([
        { quoteNumber: 2, text: "Funny quote", game: "Minecraft" },
      ]);
      await quote.execute(client, "#channel", "user", [], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", '#2: "Funny quote" [Minecraft]');
    });

    it("shows no quotes message when empty", async () => {
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      await quote.execute(client, "#channel", "user", [], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", "@user, no quotes yet. Add one with !quote add <text>");
    });

    it("shows specific quote by number", async () => {
      mocks.db.query.quotes.findFirst.mockResolvedValue({ quoteNumber: 5, text: "Hello", game: null });
      await quote.execute(client, "#channel", "user", ["5"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", '#5: "Hello"');
    });

    it("shows not found for missing quote number", async () => {
      mocks.db.query.quotes.findFirst.mockResolvedValue(null);
      await quote.execute(client, "#channel", "user", ["99"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", "@user, quote #99 not found.");
    });

    it("adds a quote as mod", async () => {
      mocks.db.query.quotes.findFirst.mockResolvedValue({ quoteNumber: 3 });
      mocks.getGame.mockReturnValue("Valorant");
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ quoteNumber: 4 }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      await quote.execute(client, "#channel", "moduser", ["add", "Something", "funny"], makeMockMsg(true));
      expect(mocks.db.insert).toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("#4"));
    });

    it("rejects add from non-mod", async () => {
      await quote.execute(client, "#channel", "user", ["add", "test"], makeMockMsg(false));
      expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("moderator"));
    });

    it("shows usage for add without text", async () => {
      await quote.execute(client, "#channel", "moduser", ["add"], makeMockMsg(true));
      expect(say).toHaveBeenCalledWith("#channel", "@moduser, usage: !quote add <text>");
    });
  });
});
