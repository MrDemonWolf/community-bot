import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
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
import { counterRouter } from "./counter";

const createCaller = t.createCallerFactory(counterRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("counterRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns counters for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findMany.mockResolvedValue([
        { id: "c1", name: "deaths", value: 10 },
        { id: "c2", name: "wins", value: 5 },
      ]);
      const result = await caller.list();
      expect(result).toHaveLength(2);
    });
  });

  describe("create", () => {
    it("creates a counter and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findUnique.mockResolvedValue(null);
      p.twitchCounter.create.mockResolvedValue({ id: "c1", name: "deaths", value: 0 });

      const result = await caller.create({ name: "deaths" });
      expect(result.name).toBe("deaths");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("counter:updated", {
        counterName: "deaths",
        channelId: "bc-1",
      });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "counter.create" })
      );
    });

    it("throws CONFLICT for duplicate name", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findUnique.mockResolvedValue({ id: "c1", name: "deaths" });
      await expect(caller.create({ name: "deaths" })).rejects.toThrow("already exists");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.create({ name: "test" })).rejects.toThrow();
    });

    it("rejects invalid names", async () => {
      const caller = authedCaller();
      await expect(caller.create({ name: "has spaces" })).rejects.toThrow();
    });
  });

  describe("update", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("updates counter value", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findUnique.mockResolvedValue({ id: UUID, name: "deaths", botChannelId: "bc-1" });
      p.twitchCounter.update.mockResolvedValue({ id: UUID, name: "deaths", value: 25 });

      const result = await caller.update({ id: UUID, value: 25 });
      expect(result.value).toBe(25);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("counter:updated", {
        counterName: "deaths",
        channelId: "bc-1",
      });
    });

    it("throws NOT_FOUND for missing counter", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findUnique.mockResolvedValue(null);
      await expect(caller.update({ id: UUID, value: 10 })).rejects.toThrow("Counter not found");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes a counter and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findUnique.mockResolvedValue({ id: UUID, name: "deaths", botChannelId: "bc-1" });
      p.twitchCounter.delete.mockResolvedValue({});

      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "counter.delete" })
      );
    });

    it("throws NOT_FOUND for counter from different channel", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchCounter.findUnique.mockResolvedValue({ id: UUID, name: "deaths", botChannelId: "bc-other" });
      await expect(caller.delete({ id: UUID })).rejects.toThrow("Counter not found");
    });
  });
});
