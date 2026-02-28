import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

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
  return { prisma: new Proxy(mp, handler), eventBus: { publish: vi.fn() }, logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { songRequestRouter } from "./songRequest";

const createCaller = t.createCallerFactory(songRequestRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("songRequestRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns song requests for the user's channel", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findMany.mockResolvedValue([
        { id: "sr-1", position: 1, title: "Song A", requestedBy: "user1" },
      ]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Song A");
    });
  });

  describe("current", () => {
    it("returns the first song request", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findFirst.mockResolvedValue({
        id: "sr-1", position: 1, title: "Song A", requestedBy: "user1",
      });
      const result = await caller.current();
      expect(result?.title).toBe("Song A");
    });

    it("returns null when queue is empty", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findFirst.mockResolvedValue(null);
      const result = await caller.current();
      expect(result).toBeNull();
    });
  });

  describe("skip", () => {
    it("skips current song and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findFirst.mockResolvedValue({
        id: "sr-1", position: 1, title: "Song A", requestedBy: "user1",
      });
      p.songRequest.delete.mockResolvedValue({});

      const result = await caller.skip();
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("song-request:updated", { channelId: "bc-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "song-request.skip" }));
    });

    it("throws NOT_FOUND when queue is empty", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findFirst.mockResolvedValue(null);
      await expect(caller.skip()).rejects.toThrow("No song request to skip");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.skip()).rejects.toThrow();
    });
  });

  describe("remove", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("removes a song request by id", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findUnique.mockResolvedValue({
        id: UUID, position: 2, title: "Song B", requestedBy: "user2", botChannelId: "bc-1",
      });
      p.songRequest.delete.mockResolvedValue({});

      const result = await caller.remove({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "song-request.remove" }));
    });

    it("throws NOT_FOUND for missing entry", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findUnique.mockResolvedValue(null);
      await expect(caller.remove({ id: UUID })).rejects.toThrow("Song request not found");
    });

    it("throws NOT_FOUND for entry from different channel", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.findUnique.mockResolvedValue({
        id: UUID, position: 1, title: "Song", botChannelId: "bc-other",
      });
      await expect(caller.remove({ id: UUID })).rejects.toThrow("Song request not found");
    });
  });

  describe("clear", () => {
    it("clears all song requests", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequest.deleteMany.mockResolvedValue({});

      const result = await caller.clear();
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "song-request.clear" }));
    });
  });

  describe("getSettings", () => {
    it("returns existing settings", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequestSettings.findUnique.mockResolvedValue({
        id: "srs-1", botChannelId: "bc-1", enabled: true, maxQueueSize: 25, maxPerUser: 3, minAccessLevel: "EVERYONE",
      });

      const result = await caller.getSettings();
      expect(result.enabled).toBe(true);
      expect(result.maxQueueSize).toBe(25);
    });

    it("returns defaults when no settings exist", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequestSettings.findUnique.mockResolvedValue(null);

      const result = await caller.getSettings();
      expect(result.enabled).toBe(false);
      expect(result.maxQueueSize).toBe(50);
    });
  });

  describe("updateSettings", () => {
    it("upserts settings and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.songRequestSettings.upsert.mockResolvedValue({
        id: "srs-1", botChannelId: "bc-1", enabled: true, maxQueueSize: 30, maxPerUser: 3, minAccessLevel: "SUBSCRIBER",
      });

      const result = await caller.updateSettings({
        enabled: true,
        maxQueueSize: 30,
        minAccessLevel: "SUBSCRIBER",
      });

      expect(result.enabled).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("song-request:settings-updated", { channelId: "bc-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "song-request.settings-update" })
      );
    });
  });
});
