import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const UUID2 = "b1ffcd00-0d1c-4fa9-8c7e-7cc0ce491b22";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "$transaction") target[prop] = vi.fn(async (ops: any[]) => Promise.all(ops));
        else if (prop === "$executeRawUnsafe") target[prop] = vi.fn();
        else target[prop] = new Proxy({} as Record<string, any>, {
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
import { playlistRouter } from "./playlist";

const createCaller = t.createCallerFactory(playlistRouter);
const p = mocks.prisma;

const BC = { id: "bc-1", userId: "user-1", enabled: true };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("playlistRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── list ────────────────────────────────────────────────────────
  describe("list", () => {
    it("returns playlists with entry counts and active ID", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(BC);

      const now = new Date();
      p.playlist.findMany.mockResolvedValue([
        { id: UUID, name: "Chill", _count: { entries: 3 }, createdAt: now, updatedAt: now },
      ]);
      p.songRequestSettings.findUnique.mockResolvedValue({ activePlaylistId: UUID });

      const result = await caller.list();
      expect(result.playlists).toHaveLength(1);
      expect(result.playlists[0]).toEqual({
        id: UUID,
        name: "Chill",
        entryCount: 3,
        createdAt: now,
        updatedAt: now,
      });
      expect(result.activePlaylistId).toBe(UUID);
    });

    it("returns null activePlaylistId when no settings exist", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findMany.mockResolvedValue([]);
      p.songRequestSettings.findUnique.mockResolvedValue(null);

      const result = await caller.list();
      expect(result.activePlaylistId).toBeNull();
    });

    it("throws PRECONDITION_FAILED when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.list()).rejects.toThrow("Authentication required");
    });
  });

  // ── get ─────────────────────────────────────────────────────────
  describe("get", () => {
    it("returns playlist with entries", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(BC);
      const playlist = {
        id: UUID,
        name: "Chill",
        botChannelId: "bc-1",
        entries: [{ id: "e1", title: "Song 1", position: 1 }],
      };
      p.playlist.findUnique.mockResolvedValue(playlist);

      const result = await caller.get({ id: UUID });
      expect(result).toEqual(playlist);
    });

    it("throws NOT_FOUND when playlist belongs to another channel", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({
        id: UUID,
        botChannelId: "other-bc",
      });

      await expect(caller.get({ id: UUID })).rejects.toThrow("Playlist not found");
    });

    it("throws NOT_FOUND when playlist does not exist", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null);

      await expect(caller.get({ id: UUID })).rejects.toThrow("Playlist not found");
    });
  });

  // ── create ──────────────────────────────────────────────────────
  describe("create", () => {
    it("creates a playlist, publishes event, and audits", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null); // no duplicate
      p.playlist.create.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });

      const result = await caller.create({ name: "Chill" });
      expect(result.id).toBe(UUID);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:created", {
        playlistId: UUID,
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.create" })
      );
    });

    it("throws CONFLICT for duplicate name", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill" });

      await expect(caller.create({ name: "Chill" })).rejects.toThrow("already exists");
    });
  });

  // ── rename ──────────────────────────────────────────────────────
  describe("rename", () => {
    it("renames a playlist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      // First findUnique (by id) returns the playlist
      p.playlist.findUnique
        .mockResolvedValueOnce({ id: UUID, name: "OldName", botChannelId: "bc-1" })
        // Second findUnique (name uniqueness check) returns null
        .mockResolvedValueOnce(null);
      p.playlist.update.mockResolvedValue({ id: UUID, name: "NewName" });

      const result = await caller.rename({ id: UUID, name: "NewName" });
      expect(result.name).toBe("NewName");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:updated", {
        playlistId: UUID,
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.update" })
      );
    });

    it("throws NOT_FOUND when playlist does not exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null);

      await expect(caller.rename({ id: UUID, name: "X" })).rejects.toThrow("Playlist not found");
    });

    it("throws CONFLICT when new name already taken by another playlist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique
        .mockResolvedValueOnce({ id: UUID, name: "OldName", botChannelId: "bc-1" })
        .mockResolvedValueOnce({ id: UUID2, name: "Taken" }); // different ID

      await expect(caller.rename({ id: UUID, name: "Taken" })).rejects.toThrow("already exists");
    });
  });

  // ── delete ──────────────────────────────────────────────────────
  describe("delete", () => {
    it("deletes a playlist and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({ activePlaylistId: null });
      p.playlist.delete.mockResolvedValue({});

      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:deleted", {
        playlistId: UUID,
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.delete" })
      );
    });

    it("clears activePlaylistId if deleted playlist is active", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({ activePlaylistId: UUID, botChannelId: "bc-1" });
      p.songRequestSettings.update.mockResolvedValue({});
      p.playlist.delete.mockResolvedValue({});

      await caller.delete({ id: UUID });
      expect(p.songRequestSettings.update).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1" },
        data: { activePlaylistId: null },
      });
    });

    it("throws NOT_FOUND when playlist does not exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null);

      await expect(caller.delete({ id: UUID })).rejects.toThrow("Playlist not found");
    });
  });

  // ── addEntry ────────────────────────────────────────────────────
  describe("addEntry", () => {
    it("adds entry at next position", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      p.playlistEntry.findFirst.mockResolvedValue({ position: 5 });
      p.playlistEntry.create.mockResolvedValue({
        id: "e1",
        title: "Song A",
        position: 6,
        playlistId: UUID,
      });

      const result = await caller.addEntry({
        playlistId: UUID,
        title: "Song A",
        youtubeVideoId: "abc123",
      });
      expect(result.position).toBe(6);
      expect(p.playlistEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 6, title: "Song A" }),
        })
      );
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:updated", {
        playlistId: UUID,
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.add-entry" })
      );
    });

    it("starts at position 1 when playlist is empty", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      p.playlistEntry.findFirst.mockResolvedValue(null);
      p.playlistEntry.create.mockResolvedValue({
        id: "e1",
        title: "First Song",
        position: 1,
      });

      await caller.addEntry({ playlistId: UUID, title: "First Song" });
      expect(p.playlistEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 1 }),
        })
      );
    });

    it("throws NOT_FOUND when playlist does not exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null);

      await expect(
        caller.addEntry({ playlistId: UUID, title: "Song" })
      ).rejects.toThrow("Playlist not found");
    });
  });

  // ── removeEntry ─────────────────────────────────────────────────
  describe("removeEntry", () => {
    it("removes entry and reorders positions", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlistEntry.findUnique.mockResolvedValue({
        id: UUID,
        title: "Song B",
        position: 2,
        playlistId: "pl-1",
        playlist: { botChannelId: "bc-1" },
      });
      p.playlistEntry.delete.mockResolvedValue({});
      p.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await caller.removeEntry({ id: UUID });
      expect(result.success).toBe(true);
      expect(p.playlistEntry.delete).toHaveBeenCalledWith({ where: { id: UUID } });
      expect(p.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("position = position - 1"),
        "pl-1",
        2
      );
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:updated", {
        playlistId: "pl-1",
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.remove-entry" })
      );
    });

    it("throws NOT_FOUND when entry does not exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlistEntry.findUnique.mockResolvedValue(null);

      await expect(caller.removeEntry({ id: UUID })).rejects.toThrow("Playlist entry not found");
    });

    it("throws NOT_FOUND when entry belongs to another channel", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlistEntry.findUnique.mockResolvedValue({
        id: UUID,
        playlist: { botChannelId: "other-bc" },
      });

      await expect(caller.removeEntry({ id: UUID })).rejects.toThrow("Playlist entry not found");
    });
  });

  // ── reorderEntries ──────────────────────────────────────────────
  describe("reorderEntries", () => {
    it("updates positions via transaction", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      // $transaction receives array of promises from playlistEntry.update calls
      p.playlistEntry.update.mockResolvedValue({});

      const entryIds = [UUID2, UUID];
      const result = await caller.reorderEntries({ playlistId: UUID, entryIds });
      expect(result.success).toBe(true);
      expect(p.$transaction).toHaveBeenCalled();
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:updated", {
        playlistId: UUID,
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.reorder" })
      );
    });

    it("throws NOT_FOUND when playlist does not exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null);

      await expect(
        caller.reorderEntries({ playlistId: UUID, entryIds: [UUID] })
      ).rejects.toThrow("Playlist not found");
    });
  });

  // ── setActive ───────────────────────────────────────────────────
  describe("setActive", () => {
    it("sets activePlaylistId on settings", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      p.songRequestSettings.upsert.mockResolvedValue({});

      const result = await caller.setActive({ playlistId: UUID });
      expect(result.success).toBe(true);
      expect(p.songRequestSettings.upsert).toHaveBeenCalledWith({
        where: { botChannelId: "bc-1" },
        update: { activePlaylistId: UUID },
        create: { botChannelId: "bc-1", activePlaylistId: UUID },
      });
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("playlist:activated", {
        playlistId: UUID,
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "playlist.activate" })
      );
    });

    it("allows setting playlistId to null (deactivate)", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.songRequestSettings.upsert.mockResolvedValue({});

      const result = await caller.setActive({ playlistId: null });
      expect(result.success).toBe(true);
      expect(p.songRequestSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { activePlaylistId: null },
        })
      );
    });

    it("throws NOT_FOUND when playlist does not exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.playlist.findUnique.mockResolvedValue(null);

      await expect(caller.setActive({ playlistId: UUID })).rejects.toThrow("Playlist not found");
    });
  });
});
