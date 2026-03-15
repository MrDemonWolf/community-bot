import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; } });
      }
      return target[prop];
    },
  };
  return { db: new Proxy(mp, handler) };
});

vi.mock("@community-bot/db", () => ({ db: mocks.db }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { auditLogRouter } from "./auditLog";

const createCaller = t.createCallerFactory(auditLogRouter);
const p = mocks.db;

describe("auditLogRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("BROADCASTER sees all logs without role filter", async () => {
      const caller = createCaller(mockSession());
      p.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      p.query.auditLogs.findMany.mockResolvedValue([]);
      p.query.auditLogs.count.mockResolvedValue(0);
      p.query.botChannels.findMany.mockResolvedValue([]);
      await caller.list();
      const call = p.query.auditLogs.findMany.mock.calls[0][0];
      expect(call.where.userRole).toBeUndefined();
    });

    it("MODERATOR only sees USER and MODERATOR logs", async () => {
      const caller = createCaller(mockSession());
      p.query.users.findFirst.mockResolvedValue({ role: "MODERATOR" });
      p.query.auditLogs.findMany.mockResolvedValue([]);
      p.query.auditLogs.count.mockResolvedValue(0);
      p.query.botChannels.findMany.mockResolvedValue([]);
      await caller.list();
      const call = p.query.auditLogs.findMany.mock.calls[0][0];
      expect(call.where.userRole.in).toContain("USER");
      expect(call.where.userRole.in).toContain("MODERATOR");
      expect(call.where.userRole.in).not.toContain("LEAD_MODERATOR");
    });

    it("USER only sees USER logs", async () => {
      const caller = createCaller(mockSession());
      p.query.users.findFirst.mockResolvedValue({ role: "USER" });
      p.query.auditLogs.findMany.mockResolvedValue([]);
      p.query.auditLogs.count.mockResolvedValue(0);
      p.query.botChannels.findMany.mockResolvedValue([]);
      await caller.list();
      const call = p.query.auditLogs.findMany.mock.calls[0][0];
      expect(call.where.userRole).toEqual({ in: ["USER"] });
    });

    it("supports action and resourceType filters", async () => {
      const caller = createCaller(mockSession());
      p.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      p.query.auditLogs.findMany.mockResolvedValue([]);
      p.query.auditLogs.count.mockResolvedValue(0);
      p.query.botChannels.findMany.mockResolvedValue([]);
      await caller.list({ action: "bot.", resourceType: "BotChannel", skip: 0, take: 10 });
      const call = p.query.auditLogs.findMany.mock.calls[0][0];
      expect(call.where.action).toEqual({ startsWith: "bot." });
      expect(call.where.resourceType).toBe("BotChannel");
    });

    it("returns isChannelOwner flag", async () => {
      const caller = createCaller(mockSession());
      p.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      p.query.auditLogs.findMany.mockResolvedValue([{
        id: "log-1", userId: "user-1", userName: "Owner", userImage: null, userRole: "BROADCASTER",
        action: "bot.enable", resourceType: "BotChannel", resourceId: "bc-1", metadata: null, createdAt: new Date(),
      }]);
      p.query.auditLogs.count.mockResolvedValue(1);
      p.query.botChannels.findMany.mockResolvedValue([{ userId: "user-1" }]);
      const result = await caller.list();
      expect(result.items[0].isChannelOwner).toBe(true);
    });

    it("paginates results", async () => {
      const caller = createCaller(mockSession());
      p.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
      p.query.auditLogs.findMany.mockResolvedValue([]);
      p.query.auditLogs.count.mockResolvedValue(50);
      p.query.botChannels.findMany.mockResolvedValue([]);
      const result = await caller.list({ skip: 10, take: 5 });
      expect(result.total).toBe(50);
      expect(p.query.auditLogs.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.list()).rejects.toThrow("Authentication required");
    });
  });
});
