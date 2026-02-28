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
import { timerRouter } from "./timer";

const createCaller = t.createCallerFactory(timerRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("timerRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns timers for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findMany.mockResolvedValue([
        { id: "t1", name: "promo", message: "Follow!", intervalMinutes: 5, chatLines: 0, enabled: true },
      ]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("creates a timer and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue(null);
      p.twitchTimer.create.mockResolvedValue({
        id: "t1", name: "promo", message: "Follow!", intervalMinutes: 5, chatLines: 0, enabled: true,
      });

      const result = await caller.create({ name: "promo", message: "Follow!", intervalMinutes: 5, chatLines: 0 });
      expect(result.name).toBe("promo");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("timer:updated", { channelId: "bc-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "timer.create" }));
    });

    it("throws CONFLICT for duplicate name", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue({ id: "t1", name: "promo" });
      await expect(caller.create({ name: "promo", message: "Hi" })).rejects.toThrow("already exists");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.create({ name: "test", message: "Hi" })).rejects.toThrow();
    });
  });

  describe("update", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("updates a timer", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue({ id: UUID, name: "promo", botChannelId: "bc-1" });
      p.twitchTimer.update.mockResolvedValue({ id: UUID, name: "promo", message: "Updated!", intervalMinutes: 10 });

      const result = await caller.update({ id: UUID, message: "Updated!", intervalMinutes: 10 });
      expect(result.message).toBe("Updated!");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("timer:updated", { channelId: "bc-1" });
    });

    it("throws NOT_FOUND for missing timer", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue(null);
      await expect(caller.update({ id: UUID, message: "Hi" })).rejects.toThrow("Timer not found");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes a timer and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue({ id: UUID, name: "promo", botChannelId: "bc-1" });
      p.twitchTimer.delete.mockResolvedValue({});

      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "timer.delete" }));
    });

    it("throws NOT_FOUND for timer from different channel", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue({ id: UUID, name: "promo", botChannelId: "bc-other" });
      await expect(caller.delete({ id: UUID })).rejects.toThrow("Timer not found");
    });
  });

  describe("toggleEnabled", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("toggles timer enabled state", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchTimer.findUnique.mockResolvedValue({ id: UUID, name: "promo", enabled: true, botChannelId: "bc-1" });
      p.twitchTimer.update.mockResolvedValue({ id: UUID, name: "promo", enabled: false });

      const result = await caller.toggleEnabled({ id: UUID });
      expect(result.enabled).toBe(false);
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "timer.toggle", metadata: expect.objectContaining({ enabled: false }) })
      );
    });
  });
});
