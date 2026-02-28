import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "$executeRawUnsafe") {
          target[prop] = vi.fn();
        } else {
          target[prop] = new Proxy({} as Record<string, any>, {
            get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
          });
        }
      }
      return target[prop];
    },
  };
  return {
    prisma: new Proxy(mp, handler),
    getUserAccessLevel: vi.fn(),
    meetsAccessLevel: vi.fn(),
    eventBus: { publish: vi.fn() },
  };
});

vi.mock("@community-bot/db", () => ({
  prisma: mocks.prisma,
  TwitchAccessLevel: {
    EVERYONE: "EVERYONE",
    SUBSCRIBER: "SUBSCRIBER",
    REGULAR: "REGULAR",
    VIP: "VIP",
    MODERATOR: "MODERATOR",
    LEAD_MODERATOR: "LEAD_MODERATOR",
    BROADCASTER: "BROADCASTER",
  },
}));
vi.mock("./accessControl.js", () => ({
  getUserAccessLevel: mocks.getUserAccessLevel,
  meetsAccessLevel: mocks.meetsAccessLevel,
}));
vi.mock("./eventBusAccessor.js", () => ({
  getEventBus: () => mocks.eventBus,
}));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

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
} from "./songRequestManager.js";

const p = mocks.prisma;

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
    it("loads and caches settings from DB", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({
        enabled: true,
        maxQueueSize: 25,
        maxPerUser: 3,
        minAccessLevel: "EVERYONE",
      });

      await loadSettings("testchannel");
      expect(isEnabled("testchannel")).toBe(true);
      expect(getSettings("testchannel")).toEqual({
        enabled: true,
        maxQueueSize: 25,
        maxPerUser: 3,
        minAccessLevel: "EVERYONE",
      });
    });

    it("uses defaults when no settings in DB", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue(null);

      await loadSettings("testchannel");
      expect(isEnabled("testchannel")).toBe(false);
      expect(getSettings("testchannel")?.maxQueueSize).toBe(50);
    });

    it("does nothing when no bot channel", async () => {
      p.botChannel.findFirst.mockResolvedValue(null);
      await loadSettings("unknown");
      expect(getSettings("unknown")).toBeNull();
    });
  });

  describe("addRequest", () => {
    beforeEach(async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({
        enabled: true,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
      });
      await loadSettings("testchannel");
      mocks.meetsAccessLevel.mockReturnValue(true);
    });

    it("adds a song request", async () => {
      p.songRequest.count.mockResolvedValue(0);
      p.songRequest.findFirst.mockResolvedValue(null);
      p.songRequest.create.mockResolvedValue({});

      const result = await addRequest("#testchannel", "Never Gonna Give You Up", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: true, position: 1 });
      expect(p.songRequest.create).toHaveBeenCalledWith({
        data: {
          position: 1,
          title: "Never Gonna Give You Up",
          requestedBy: "viewer1",
          botChannelId: "bc-1",
        },
      });
    });

    it("rejects when queue is full", async () => {
      p.songRequest.count.mockResolvedValueOnce(50);

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "The song request queue is full." });
    });

    it("rejects when user hits per-user limit", async () => {
      p.songRequest.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      const result = await addRequest("#testchannel", "Song", "viewer1", makeMockMsg());
      expect(result).toEqual({ ok: false, reason: "You can only have 5 song(s) in the queue." });
    });

    it("rejects when disabled", async () => {
      clearCache("testchannel");
      p.songRequestSettings.findUnique.mockResolvedValue({
        enabled: false,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
      });
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
    it("skips the current song and reorders", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.findFirst.mockResolvedValue({
        id: "sr-1",
        position: 1,
        title: "Song A",
        requestedBy: "viewer1",
      });
      p.songRequest.delete.mockResolvedValue({});

      const result = await skipRequest("#testchannel");
      expect(result).toEqual({ title: "Song A", requestedBy: "viewer1" });
      expect(p.$executeRawUnsafe).toHaveBeenCalled();
    });

    it("returns null when queue is empty", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.findFirst.mockResolvedValue(null);

      const result = await skipRequest("#testchannel");
      expect(result).toBeNull();
    });
  });

  describe("removeRequest", () => {
    it("removes a request at a given position", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.findFirst.mockResolvedValue({ id: "sr-1", position: 2 });
      p.songRequest.delete.mockResolvedValue({});

      const result = await removeRequest("#testchannel", 2);
      expect(result).toBe(true);
      expect(p.$executeRawUnsafe).toHaveBeenCalled();
    });

    it("returns false when position not found", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.findFirst.mockResolvedValue(null);

      const result = await removeRequest("#testchannel", 99);
      expect(result).toBe(false);
    });
  });

  describe("listRequests", () => {
    it("returns ordered entries", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.findMany.mockResolvedValue([
        { position: 1, title: "Song A", requestedBy: "user1" },
        { position: 2, title: "Song B", requestedBy: "user2" },
      ]);

      const result = await listRequests("#testchannel");
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Song A");
    });
  });

  describe("clearRequests", () => {
    it("deletes all requests for a channel", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.deleteMany.mockResolvedValue({});

      await clearRequests("#testchannel");
      expect(p.songRequest.deleteMany).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1" },
      });
    });
  });

  describe("removeByUser", () => {
    it("removes all of a user's requests", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.songRequest.findMany.mockResolvedValue([
        { id: "sr-1", position: 2 },
        { id: "sr-2", position: 5 },
      ]);
      p.songRequest.delete.mockResolvedValue({});

      const count = await removeByUser("#testchannel", "viewer1");
      expect(count).toBe(2);
    });
  });
});
