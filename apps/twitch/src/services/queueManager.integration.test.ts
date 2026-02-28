import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedQueueEntry,
} from "@community-bot/db/test-client";

vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});
vi.mock("./eventBusAccessor.js", () => ({
  getEventBus: () => ({ publish: vi.fn() }),
}));

import {
  join,
  leave,
  pick,
  remove,
  clear,
  getQueueStatus,
  setQueueStatus,
  getPosition,
  listEntries,
} from "./queueManager.js";
import { QueueStatus } from "@community-bot/db";

describe("queueManager (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  describe("getQueueStatus / setQueueStatus", () => {
    it("defaults to CLOSED when no state exists", async () => {
      const status = await getQueueStatus();
      expect(status).toBe(QueueStatus.CLOSED);
    });

    it("persists status changes to DB", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      const status = await getQueueStatus();
      expect(status).toBe(QueueStatus.OPEN);
    });

    it("transitions between all statuses", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await setQueueStatus(QueueStatus.PAUSED);
      expect(await getQueueStatus()).toBe(QueueStatus.PAUSED);
      await setQueueStatus(QueueStatus.CLOSED);
      expect(await getQueueStatus()).toBe(QueueStatus.CLOSED);
    });
  });

  describe("join", () => {
    it("creates a queue entry with correct position", async () => {
      await setQueueStatus(QueueStatus.OPEN);

      const r1 = await join("user1", "Viewer1");
      expect(r1).toEqual({ ok: true, position: 1 });

      const r2 = await join("user2", "Viewer2");
      expect(r2).toEqual({ ok: true, position: 2 });

      const entries = await testPrisma.queueEntry.findMany({
        orderBy: { position: "asc" },
      });
      expect(entries).toHaveLength(2);
      expect(entries[0].twitchUsername).toBe("Viewer1");
      expect(entries[1].twitchUsername).toBe("Viewer2");
    });

    it("rejects duplicate join", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("user1", "Viewer1");

      const r = await join("user1", "Viewer1");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("already in the queue");
    });

    it("rejects join when queue is CLOSED", async () => {
      const r = await join("user1", "Viewer1");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("not open");
    });

    it("rejects join when queue is PAUSED", async () => {
      await setQueueStatus(QueueStatus.PAUSED);
      const r = await join("user1", "Viewer1");
      expect(r.ok).toBe(false);
    });
  });

  describe("leave", () => {
    it("removes entry and reorders positions", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "V1");
      await join("u2", "V2");
      await join("u3", "V3");

      const left = await leave("u2");
      expect(left).toBe(true);

      const entries = await testPrisma.queueEntry.findMany({
        orderBy: { position: "asc" },
      });
      expect(entries).toHaveLength(2);
      expect(entries[0].twitchUsername).toBe("V1");
      expect(entries[0].position).toBe(1);
      expect(entries[1].twitchUsername).toBe("V3");
      expect(entries[1].position).toBe(2);
    });

    it("returns false for non-existent user", async () => {
      const left = await leave("nonexistent");
      expect(left).toBe(false);
    });
  });

  describe("getPosition", () => {
    it("returns the user's position", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "V1");
      await join("u2", "V2");

      expect(await getPosition("u2")).toBe(2);
    });

    it("returns null for non-existent user", async () => {
      expect(await getPosition("nobody")).toBeNull();
    });
  });

  describe("pick", () => {
    it("picks next (lowest position) entry", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "V1");
      await join("u2", "V2");
      await join("u3", "V3");

      const picked = await pick("next");
      expect(picked).not.toBeNull();
      expect(picked!.twitchUsername).toBe("V1");

      const entries = await testPrisma.queueEntry.findMany({
        orderBy: { position: "asc" },
      });
      expect(entries).toHaveLength(2);
      expect(entries[0].position).toBe(1);
      expect(entries[0].twitchUsername).toBe("V2");
    });

    it("picks random entry", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "V1");
      await join("u2", "V2");

      const picked = await pick("random");
      expect(picked).not.toBeNull();

      const entries = await testPrisma.queueEntry.findMany();
      expect(entries).toHaveLength(1);
    });

    it("picks by username (case-insensitive)", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "ViewerOne");
      await join("u2", "ViewerTwo");

      const picked = await pick("viewertwo");
      expect(picked).not.toBeNull();
      expect(picked!.twitchUsername).toBe("ViewerTwo");
    });

    it("returns null for empty queue", async () => {
      const picked = await pick("next");
      expect(picked).toBeNull();
    });
  });

  describe("remove", () => {
    it("removes by username and reorders", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "V1");
      await join("u2", "V2");
      await join("u3", "V3");

      const removed = await remove("V2");
      expect(removed).toBe(true);

      const entries = await testPrisma.queueEntry.findMany({
        orderBy: { position: "asc" },
      });
      expect(entries).toHaveLength(2);
      expect(entries[0].position).toBe(1);
      expect(entries[1].position).toBe(2);
    });

    it("returns false for non-existent username", async () => {
      const removed = await remove("nobody");
      expect(removed).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all entries", async () => {
      await setQueueStatus(QueueStatus.OPEN);
      await join("u1", "V1");
      await join("u2", "V2");

      await clear();

      const entries = await testPrisma.queueEntry.findMany();
      expect(entries).toHaveLength(0);
    });
  });

  describe("listEntries", () => {
    it("returns entries ordered by position", async () => {
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u2",
        twitchUsername: "V2",
        position: 2,
      });
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u1",
        twitchUsername: "V1",
        position: 1,
      });

      const entries = await listEntries();
      expect(entries[0].twitchUsername).toBe("V1");
      expect(entries[1].twitchUsername).toBe("V2");
    });
  });
});
