import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
  seedQueueEntry,
} from "@community-bot/db/test-client";

// Mock EventBus and external deps — keep DB real
vi.mock("../events", () => ({ eventBus: { publish: vi.fn() } }));
vi.mock("../utils/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@community-bot/db", () => ({
  prisma: testPrisma,
  QueueStatus: { OPEN: "OPEN", CLOSED: "CLOSED", PAUSED: "PAUSED" },
}));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({
  env: { REDIS_URL: "redis://localhost" },
}));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { queueRouter } from "./queue";

const createCaller = t.createCallerFactory(queueRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "Test", image: null, email: "t@t.t" } },
  };
}

describe("queueRouter (integration)", () => {
  let broadcaster: Awaited<ReturnType<typeof seedUser>>;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    broadcaster = await seedUser(testPrisma, {
      id: "broadcaster-1",
      role: "BROADCASTER",
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  function authedCaller(userId = broadcaster.id) {
    return createCaller(session(userId));
  }

  describe("getState", () => {
    it("creates and returns singleton CLOSED state by default", async () => {
      const caller = authedCaller();
      const state = await caller.getState();
      expect(state.id).toBe("singleton");
      expect(state.status).toBe("CLOSED");
    });
  });

  describe("setStatus", () => {
    it("sets status to OPEN in the real database", async () => {
      const caller = authedCaller();
      const state = await caller.setStatus({ status: "OPEN" });
      expect(state.status).toBe("OPEN");

      // Verify in DB
      const dbState = await testPrisma.queueState.findUnique({
        where: { id: "singleton" },
      });
      expect(dbState!.status).toBe("OPEN");
    });

    it("transitions between statuses", async () => {
      const caller = authedCaller();
      await caller.setStatus({ status: "OPEN" });
      await caller.setStatus({ status: "PAUSED" });
      const state = await caller.setStatus({ status: "CLOSED" });
      expect(state.status).toBe("CLOSED");
    });
  });

  describe("list", () => {
    it("returns entries ordered by position", async () => {
      const caller = authedCaller();
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u3",
        twitchUsername: "viewer3",
        position: 3,
      });
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u1",
        twitchUsername: "viewer1",
        position: 1,
      });
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u2",
        twitchUsername: "viewer2",
        position: 2,
      });

      const entries = await caller.list();
      expect(entries).toHaveLength(3);
      expect(entries[0].twitchUsername).toBe("viewer1");
      expect(entries[1].twitchUsername).toBe("viewer2");
      expect(entries[2].twitchUsername).toBe("viewer3");
    });
  });

  describe("removeEntry", () => {
    it("removes entry and reorders positions via raw SQL", async () => {
      const caller = authedCaller();
      const e1 = await seedQueueEntry(testPrisma, {
        twitchUserId: "u1",
        position: 1,
      });
      await seedQueueEntry(testPrisma, { twitchUserId: "u2", position: 2 });
      await seedQueueEntry(testPrisma, { twitchUserId: "u3", position: 3 });

      await caller.removeEntry({ id: e1.id });

      const remaining = await testPrisma.queueEntry.findMany({
        orderBy: { position: "asc" },
      });
      expect(remaining).toHaveLength(2);
      expect(remaining[0].position).toBe(1);
      expect(remaining[1].position).toBe(2);
    });

    it("throws NOT_FOUND for non-existent entry", async () => {
      const caller = authedCaller();
      await expect(
        caller.removeEntry({ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
      ).rejects.toThrow("Queue entry not found");
    });
  });

  describe("pickEntry", () => {
    it("picks next (lowest position) entry and reorders", async () => {
      const caller = authedCaller();
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u1",
        twitchUsername: "first",
        position: 1,
      });
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u2",
        twitchUsername: "second",
        position: 2,
      });
      await seedQueueEntry(testPrisma, {
        twitchUserId: "u3",
        twitchUsername: "third",
        position: 3,
      });

      const picked = await caller.pickEntry({ mode: "next" });
      expect(picked.twitchUsername).toBe("first");

      const remaining = await testPrisma.queueEntry.findMany({
        orderBy: { position: "asc" },
      });
      expect(remaining).toHaveLength(2);
      expect(remaining[0].position).toBe(1);
      expect(remaining[0].twitchUsername).toBe("second");
    });

    it("picks random entry from queue", async () => {
      const caller = authedCaller();
      await seedQueueEntry(testPrisma, { twitchUserId: "u1", position: 1 });
      await seedQueueEntry(testPrisma, { twitchUserId: "u2", position: 2 });

      const picked = await caller.pickEntry({ mode: "random" });
      expect(picked.twitchUserId).toBeDefined();

      const remaining = await testPrisma.queueEntry.findMany();
      expect(remaining).toHaveLength(1);
    });

    it("throws NOT_FOUND for empty queue (next)", async () => {
      const caller = authedCaller();
      await expect(caller.pickEntry({ mode: "next" })).rejects.toThrow(
        "Queue is empty"
      );
    });

    it("throws NOT_FOUND for empty queue (random)", async () => {
      const caller = authedCaller();
      await expect(caller.pickEntry({ mode: "random" })).rejects.toThrow(
        "Queue is empty"
      );
    });
  });

  describe("clear", () => {
    it("removes all entries from the database", async () => {
      const caller = authedCaller();
      await seedQueueEntry(testPrisma, { twitchUserId: "u1", position: 1 });
      await seedQueueEntry(testPrisma, { twitchUserId: "u2", position: 2 });
      await seedQueueEntry(testPrisma, { twitchUserId: "u3", position: 3 });

      const result = await caller.clear();
      expect(result.success).toBe(true);
      expect(result.cleared).toBe(3);

      const remaining = await testPrisma.queueEntry.findMany();
      expect(remaining).toHaveLength(0);
    });
  });
});
