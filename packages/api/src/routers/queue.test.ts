import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

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

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma, QueueStatus: { OPEN: "OPEN", CLOSED: "CLOSED", PAUSED: "PAUSED" } }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { queueRouter } from "./queue";

const createCaller = t.createCallerFactory(queueRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("queueRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getState", () => {
    it("upserts and returns singleton queue state", async () => {
      const caller = createCaller(mockSession());
      p.queueState.upsert.mockResolvedValue({ id: "singleton", status: "CLOSED" });
      const result = await caller.getState();
      expect(result.status).toBe("CLOSED");
    });
  });

  describe("list", () => {
    it("returns queue entries ordered by position", async () => {
      const caller = createCaller(mockSession());
      p.queueEntry.findMany.mockResolvedValue([{ id: "e1", position: 1 }, { id: "e2", position: 2 }]);
      const result = await caller.list();
      expect(result).toHaveLength(2);
    });
  });

  describe("setStatus", () => {
    it("sets status to OPEN and publishes event", async () => {
      const caller = authedCaller();
      p.queueState.upsert.mockResolvedValue({ id: "singleton", status: "OPEN" });
      const result = await caller.setStatus({ status: "OPEN" });
      expect(result.status).toBe("OPEN");
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "queue.open" }));
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("queue:updated", { channelId: "singleton" });
    });

    it("maps CLOSED to queue.close", async () => {
      const caller = authedCaller();
      p.queueState.upsert.mockResolvedValue({ id: "singleton", status: "CLOSED" });
      await caller.setStatus({ status: "CLOSED" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "queue.close" }));
    });

    it("maps PAUSED to queue.pause", async () => {
      const caller = authedCaller();
      p.queueState.upsert.mockResolvedValue({ id: "singleton", status: "PAUSED" });
      await caller.setStatus({ status: "PAUSED" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "queue.pause" }));
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.setStatus({ status: "OPEN" })).rejects.toThrow();
    });
  });

  describe("removeEntry", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("removes entry and reorders positions", async () => {
      const caller = authedCaller();
      p.queueEntry.findUnique.mockResolvedValue({ id: "e1", position: 2, twitchUsername: "v1" });
      p.queueEntry.delete.mockResolvedValue({});
      const result = await caller.removeEntry({ id: UUID });
      expect(result.success).toBe(true);
      expect(p.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("position = position - 1"), 2);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("queue:updated", { channelId: "singleton" });
    });

    it("throws NOT_FOUND for missing entry", async () => {
      const caller = authedCaller();
      p.queueEntry.findUnique.mockResolvedValue(null);
      await expect(caller.removeEntry({ id: UUID })).rejects.toThrow("Queue entry not found");
    });
  });

  describe("pickEntry", () => {
    it("picks next entry", async () => {
      const caller = authedCaller();
      p.queueEntry.findFirst.mockResolvedValue({ id: "e1", position: 1, twitchUsername: "v1" });
      p.queueEntry.delete.mockResolvedValue({});
      const result = await caller.pickEntry({ mode: "next" });
      expect(result.id).toBe("e1");
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "queue.pick", metadata: expect.objectContaining({ mode: "next" }) }));
    });

    it("throws NOT_FOUND for empty queue (next)", async () => {
      const caller = authedCaller();
      p.queueEntry.findFirst.mockResolvedValue(null);
      await expect(caller.pickEntry({ mode: "next" })).rejects.toThrow("Queue is empty");
    });

    it("throws NOT_FOUND for empty queue (random)", async () => {
      const caller = authedCaller();
      p.queueEntry.count.mockResolvedValue(0);
      await expect(caller.pickEntry({ mode: "random" })).rejects.toThrow("Queue is empty");
    });
  });

  describe("clear", () => {
    it("clears all entries and publishes event", async () => {
      const caller = authedCaller();
      p.queueEntry.count.mockResolvedValue(5);
      p.queueEntry.deleteMany.mockResolvedValue({ count: 5 });
      const result = await caller.clear();
      expect(result.success).toBe(true);
      expect(result.cleared).toBe(5);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "queue.clear", metadata: { entriesCleared: 5 } }));
    });
  });
});
