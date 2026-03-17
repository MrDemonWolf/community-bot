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
  return {
    db: {
      query: queryProxy,
      insert: vi.fn(() => chainProxy()),
      update: vi.fn(() => chainProxy()),
      delete: vi.fn(() => chainProxy()),
      select: vi.fn(() => chainProxy()),
      execute: vi.fn(),
      transaction: vi.fn(),
    },
    getUserAccessLevel: vi.fn(),
    meetsAccessLevel: vi.fn(),
    eventBus: { publish: vi.fn() },
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
vi.mock("./accessControl.js", () => ({
  getUserAccessLevel: mocks.getUserAccessLevel,
  meetsAccessLevel: mocks.meetsAccessLevel }));
vi.mock("./eventBusAccessor.js", () => ({
  getEventBus: () => mocks.eventBus }));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));

import {
  loadSettings,
  clearCache,
  isEnabled,
  getSettings,
  addRequest,
  removeRequest,
  skipRequest,
  listRequests,
  currentRequest,
  clearRequests,
  removeByUser,
  addFromPlaylist,
  listPlaylists,
  activatePlaylist,
} from "./songRequestManager.js";

function makeMockMsg() {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod: false, isBroadcaster: false },
  } as any;
}

describe("songRequestManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache("testchannel");
  });

  describe("loadSettings", () => {
    it("loads and caches settings from DB including new fields", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
        maxDuration: 300,
        autoPlayEnabled: false,
        activePlaylistId: null });
      await loadSettings("testchannel");
      expect(isEnabled("testchannel")).toBe(true);
      const settings = getSettings("testchannel");
      expect(settings?.maxDuration).toBe(300);
    });

    it("defaults to disabled when no settings", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue(null);
      await loadSettings("testchannel");
      expect(isEnabled("testchannel")).toBe(false);
    });
  });

  describe("addRequest", () => {
    beforeEach(async () => {
      clearCache("testchannel");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
        maxDuration: null,
        autoPlayEnabled: false,
        activePlaylistId: null });
      await loadSettings("testchannel");
      mocks.meetsAccessLevel.mockReturnValue(true);
    });

    it("adds a song request with YouTube metadata", async () => {
      // db.select count for queue size
      const selectChain1 = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      // db.select count for per-user
      const selectChain2 = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 0 }]) }) };
      mocks.db.select.mockReturnValueOnce(selectChain1).mockReturnValueOnce(selectChain2);
      // db.query.songRequests.findFirst for last position
      mocks.db.query.songRequests.findFirst.mockResolvedValue(null);
      // db.insert
      const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
      mocks.db.insert.mockReturnValue(insertChain);

      const youtubeInfo = { videoId: "dQw4w9WgXcQ", title: "Rick", duration: 213, thumbnail: "", channelName: "Rick Astley" };
      const result = await addRequest("#testchannel", "Rick Astley", "viewer1", makeMockMsg(), youtubeInfo);
      expect(result).toEqual({ ok: true, position: 1 });
    });

    it("rejects when not enabled", async () => {
      clearCache("testchannel");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: false, maxQueueSize: 50, maxPerUser: 5, minAccessLevel: "EVERYONE",
        maxDuration: null, autoPlayEnabled: false, activePlaylistId: null });
      await loadSettings("testchannel");

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "Song requests are not enabled." });
    });

    it("rejects when access level not met", async () => {
      mocks.meetsAccessLevel.mockReturnValue(false);
      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "You don't have permission to request songs." });
    });

    it("rejects when queue is full", async () => {
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 50 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "The song request queue is full." });
    });

    it("rejects when user hits per-user limit", async () => {
      const selectChain1 = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 10 }]) }) };
      const selectChain2 = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 5 }]) }) };
      mocks.db.select.mockReturnValueOnce(selectChain1).mockReturnValueOnce(selectChain2);
      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "You can only have 5 song(s) in the queue." });
    });
  });

  describe("listRequests", () => {
    it("returns ordered entries with YouTube fields", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequests.findMany.mockResolvedValue([
        { position: 1, title: "Song A", requestedBy: "user1", youtubeVideoId: "vid1", youtubeDuration: 180 },
        { position: 2, title: "Song B", requestedBy: "user2", youtubeVideoId: null, youtubeDuration: null },
      ]);

      const result = await listRequests("#testchannel");
      expect(result).toHaveLength(2);
      expect(result[0].youtubeVideoId).toBe("vid1");
    });
  });

  describe("clearRequests", () => {
    it("deletes all requests for a channel", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      await clearRequests("#testchannel");
      expect(mocks.db.delete).toHaveBeenCalled();
    });
  });

  describe("removeByUser", () => {
    it("removes all of a user's requests", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequests.findMany.mockResolvedValue([
        { id: "sr-1", position: 2 },
        { id: "sr-2", position: 5 },
      ]);
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
      mocks.db.transaction.mockImplementation(async (fn: any) => fn({
        delete: vi.fn(() => txChain()),
        execute: vi.fn().mockResolvedValue(undefined),
      }));

      const count = await removeByUser("#testchannel", "viewer1");
      expect(count).toBe(2);
    });
  });

  describe("listPlaylists", () => {
    it("returns playlists for a channel", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.playlists.findMany.mockResolvedValue([
        { id: "p1", name: "Chill" },
        { id: "p2", name: "Hype" },
      ]);

      const result = await listPlaylists("#testchannel");
      expect(result).toHaveLength(2);
    });
  });

  describe("activatePlaylist", () => {
    it("activates a playlist by name", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.playlists.findFirst.mockResolvedValue({ id: "p1", name: "Chill" });
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5,
        minAccessLevel: "EVERYONE", maxDuration: null,
        autoPlayEnabled: true, activePlaylistId: "p1" });

      const result = await activatePlaylist("#testchannel", "Chill");
      expect(result).toBe(true);
    });

    it("returns false when playlist not found", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.playlists.findFirst.mockResolvedValue(null);
      const result = await activatePlaylist("#testchannel", "NonExistent");
      expect(result).toBe(false);
    });
  });
});
