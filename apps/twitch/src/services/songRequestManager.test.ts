import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "transaction") target[prop] = vi.fn(async (arg: any) => typeof arg === "function" ? arg(new Proxy(mp, handler)) : Promise.all(arg));
        else if (prop === "execute") target[prop] = vi.fn();
        else target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; } });
      }
      return target[prop];
    },
  };
  return {
    db: new Proxy(mp, handler),
    getUserAccessLevel: vi.fn(),
    meetsAccessLevel: vi.fn(),
    eventBus: { publish: vi.fn() },
  };
});

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  TwitchAccessLevel: {
    EVERYONE: "EVERYONE",
    SUBSCRIBER: "SUBSCRIBER",
    REGULAR: "REGULAR",
    VIP: "VIP",
    MODERATOR: "MODERATOR",
    LEAD_MODERATOR: "LEAD_MODERATOR",
    BROADCASTER: "BROADCASTER",
  } }));
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

const p = mocks.db;

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
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true,
        maxQueueSize: 25,
        maxPerUser: 3,
        minAccessLevel: "EVERYONE",
        maxDuration: 600,
        autoPlayEnabled: true,
        activePlaylistId: "pl-1" });

      await loadSettings("testchannel");
      expect(isEnabled("testchannel")).toBe(true);
      const settings = getSettings("testchannel");
      expect(settings).toEqual({
        enabled: true,
        maxQueueSize: 25,
        maxPerUser: 3,
        minAccessLevel: "EVERYONE",
        maxDuration: 600,
        autoPlayEnabled: true,
        activePlaylistId: "pl-1" });
    });

    it("uses defaults when no settings in DB", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequestSettings.findFirst.mockResolvedValue(null);

      await loadSettings("testchannel");
      expect(isEnabled("testchannel")).toBe(false);
      const settings = getSettings("testchannel");
      expect(settings?.maxDuration).toBeNull();
      expect(settings?.autoPlayEnabled).toBe(false);
      expect(settings?.activePlaylistId).toBeNull();
    });

    it("does nothing when no bot channel", async () => {
      p.query.botChannels.findFirst.mockResolvedValue(null);
      await loadSettings("unknown");
      expect(getSettings("unknown")).toBeNull();
    });
  });

  describe("addRequest", () => {
    beforeEach(async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequestSettings.findFirst.mockResolvedValue({
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
      p.query.songRequests.count.mockResolvedValue(0);
      p.query.songRequests.findFirst.mockResolvedValue(null);
      p.query.songRequests.create.mockResolvedValue({});

      const youtubeInfo = {
        videoId: "dQw4w9WgXcQ",
        title: "Rick Astley",
        duration: 213,
        thumbnail: "thumb.jpg",
        channelName: "Rick",
      };

      const result = await addRequest("#testchannel", "Rick Astley", "viewer1", makeMockMsg(), youtubeInfo);
      expect(result).toEqual({ ok: true, position: 1 });
      expect(p.query.songRequests.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          youtubeVideoId: "dQw4w9WgXcQ",
          youtubeDuration: 213,
          source: "viewer" }) });
    });

    it("adds a song request without YouTube metadata", async () => {
      p.query.songRequests.count.mockResolvedValue(0);
      p.query.songRequests.findFirst.mockResolvedValue(null);
      p.query.songRequests.create.mockResolvedValue({});

      const result = await addRequest("#testchannel", "Some Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: true, position: 1 });
      expect(p.query.songRequests.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          youtubeVideoId: null,
          source: "viewer" }) });
    });

    it("rejects when song exceeds max duration", async () => {
      clearCache("testchannel");
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
        maxDuration: 300,
        autoPlayEnabled: false,
        activePlaylistId: null });
      await loadSettings("testchannel");
      mocks.meetsAccessLevel.mockReturnValue(true);

      const youtubeInfo = {
        videoId: "abc",
        title: "Long Song",
        duration: 600,
        thumbnail: "",
        channelName: "Artist",
      };

      const result = await addRequest("#testchannel", "Long Song", "viewer1", makeMockMsg(), youtubeInfo);
      expect(result.ok).toBe(false);
      expect((result as any).reason).toContain("maximum duration");
    });

    it("rejects when queue is full", async () => {
      p.query.songRequests.count.mockResolvedValueOnce(50);

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "The song request queue is full." });
    });

    it("rejects when user hits per-user limit", async () => {
      p.query.songRequests.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "You can only have 5 song(s) in the queue." });
    });

    it("rejects when disabled", async () => {
      clearCache("testchannel");
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: false,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
        maxDuration: null,
        autoPlayEnabled: false,
        activePlaylistId: null });
      await loadSettings("testchannel");

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "Song requests are not enabled." });
    });

    it("rejects when access level not met", async () => {
      mocks.meetsAccessLevel.mockReturnValue(false);

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "You don't have permission to request songs." });
    });
  });

  describe("skipRequest", () => {
    it("skips the current song and includes autoPlaySong", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.findFirst.mockResolvedValue({
        id: "sr-1",
        position: 1,
        title: "Song A",
        requestedBy: "viewer1" });
      p.query.songRequests.delete.mockResolvedValue({});
      p.query.songRequests.count.mockResolvedValue(0);

      // No auto-play configured
      clearCache("testchannel");
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5,
        minAccessLevel: "EVERYONE", maxDuration: null,
        autoPlayEnabled: false, activePlaylistId: null });
      await loadSettings("testchannel");

      const result = await skipRequest("#testchannel");
      expect(result).toEqual({
        title: "Song A",
        requestedBy: "viewer1",
        autoPlaySong: null });
      expect(p.execute).toHaveBeenCalled();
    });

    it("returns null when queue is empty", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.findFirst.mockResolvedValue(null);

      const result = await skipRequest("#testchannel");
      expect(result).toBeNull();
    });
  });

  describe("addFromPlaylist", () => {
    it("adds next playlist entry when auto-play is enabled", async () => {
      clearCache("testchannel");
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5,
        minAccessLevel: "EVERYONE", maxDuration: null,
        autoPlayEnabled: true, activePlaylistId: "pl-1" });
      await loadSettings("testchannel");

      p.query.playlistEntries.findFirst.mockResolvedValue({
        title: "Playlist Song",
        youtubeVideoId: "vid-1",
        youtubeDuration: 200,
        youtubeThumbnail: "thumb.jpg",
        youtubeChannel: "Artist" });
      p.query.songRequests.findFirst.mockResolvedValue(null);
      p.query.songRequests.create.mockResolvedValue({});

      const result = await addFromPlaylist("#testchannel");
      expect(result).toEqual({ title: "Playlist Song", youtubeVideoId: "vid-1" });
      expect(p.query.songRequests.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: "playlist",
          requestedBy: "playlist" }) });
    });

    it("returns null when auto-play is disabled", async () => {
      clearCache("testchannel");
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5,
        minAccessLevel: "EVERYONE", maxDuration: null,
        autoPlayEnabled: false, activePlaylistId: null });
      await loadSettings("testchannel");

      const result = await addFromPlaylist("#testchannel");
      expect(result).toBeNull();
    });

    it("returns null when playlist is exhausted", async () => {
      clearCache("testchannel");
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5,
        minAccessLevel: "EVERYONE", maxDuration: null,
        autoPlayEnabled: true, activePlaylistId: "pl-1" });
      await loadSettings("testchannel");

      p.query.playlistEntries.findFirst.mockResolvedValue(null);

      const result = await addFromPlaylist("#testchannel");
      expect(result).toBeNull();
    });
  });

  describe("removeRequest", () => {
    it("removes a request at a given position", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.findFirst.mockResolvedValue({ id: "sr-1", position: 2 });
      p.query.songRequests.delete.mockResolvedValue({});

      const result = await removeRequest("#testchannel", 2);
      expect(result).toBe(true);
      expect(p.execute).toHaveBeenCalled();
    });

    it("returns false when position not found", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.findFirst.mockResolvedValue(null);

      const result = await removeRequest("#testchannel", 99);
      expect(result).toBe(false);
    });
  });

  describe("listRequests", () => {
    it("returns ordered entries with YouTube fields", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.findMany.mockResolvedValue([
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
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.deleteMany.mockResolvedValue({});

      await clearRequests("#testchannel");
      expect(p.query.songRequests.deleteMany).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1" } });
    });
  });

  describe("removeByUser", () => {
    it("removes all of a user's requests", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.songRequests.findMany.mockResolvedValue([
        { id: "sr-1", position: 2 },
        { id: "sr-2", position: 5 },
      ]);
      p.query.songRequests.deleteMany.mockResolvedValue({ count: 2 });

      const count = await removeByUser("#testchannel", "viewer1");
      expect(count).toBe(2);
    });
  });

  describe("listPlaylists", () => {
    it("returns playlists for a channel", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.playlists.findMany.mockResolvedValue([
        { id: "p1", name: "Chill" },
        { id: "p2", name: "Hype" },
      ]);

      const result = await listPlaylists("#testchannel");
      expect(result).toHaveLength(2);
    });
  });

  describe("activatePlaylist", () => {
    it("activates a playlist by name", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.playlists.findFirst.mockResolvedValue({ id: "p1", name: "Chill" });
      p.query.songRequestSettings.upsert.mockResolvedValue({});
      p.query.songRequestSettings.findFirst.mockResolvedValue({
        enabled: true, maxQueueSize: 50, maxPerUser: 5,
        minAccessLevel: "EVERYONE", maxDuration: null,
        autoPlayEnabled: true, activePlaylistId: "p1" });

      const result = await activatePlaylist("#testchannel", "Chill");
      expect(result).toBe(true);
      expect(p.query.songRequestSettings.upsert).toHaveBeenCalled();
    });

    it("returns false when playlist not found", async () => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      p.query.playlists.findFirst.mockResolvedValue(null);

      const result = await activatePlaylist("#testchannel", "NonExistent");
      expect(result).toBe(false);
    });
  });
});
