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
      },
      insert: vi.fn(() => chainProxy()),
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

import { permit } from "./permit.js";

function makeMockMsg(isMod = true) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("permit command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("does nothing if user is not a mod", async () => {
    await permit.execute(client, "#channel", "user", ["viewer1"], makeMockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage when no args", async () => {
    await permit.execute(client, "#channel", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("usage"));
  });

  it("creates a permit for the target user", async () => {
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    const chain = { values: vi.fn().mockResolvedValue(undefined) };
    mocks.db.insert.mockReturnValue(chain);
    await permit.execute(client, "#channel", "moduser", ["viewer1"], makeMockMsg());
    expect(mocks.db.insert).toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith("#channel", expect.stringContaining("viewer1"));
  });

  it("does nothing when no bot channel", async () => {
    mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
    await permit.execute(client, "#channel", "moduser", ["viewer1"], makeMockMsg());
    // permit silently returns when no bot channel found
    expect(say).not.toHaveBeenCalled();
  });
});
