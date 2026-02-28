import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "$transaction") target[prop] = vi.fn(async (ops: any[]) => Promise.all(ops));
        else target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return { prisma: new Proxy(mp, handler), logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { userManagementRouter } from "./userManagement";

const createCaller = t.createCallerFactory(userManagementRouter);
const p = mocks.prisma;

function authedCaller(role = "BROADCASTER", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("userManagementRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns paginated users", async () => {
      const caller = authedCaller();
      p.user.findMany.mockResolvedValue([{ ...mockUser(), accounts: [] }]);
      p.user.count.mockResolvedValue(1);
      const result = await caller.list();
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("supports search filtering", async () => {
      const caller = authedCaller();
      p.user.findMany.mockResolvedValue([]);
      p.user.count.mockResolvedValue(0);
      await caller.list({ search: "alice", skip: 0, take: 25 });
      expect(p.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }));
    });

    it("rejects non-BROADCASTER role", async () => {
      const caller = authedCaller("MODERATOR");
      await expect(caller.list()).rejects.toThrow();
    });

    it("rejects unauthenticated calls", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.list()).rejects.toThrow("Authentication required");
    });

    it("rejects banned users", async () => {
      p.user.findUnique.mockResolvedValue(mockUser({ role: "BROADCASTER", banned: true }));
      const caller = createCaller(mockSession());
      await expect(caller.list()).rejects.toThrow();
    });
  });

  describe("getUser", () => {
    it("returns user details", async () => {
      const caller = authedCaller();
      p.user.findUnique
        .mockResolvedValueOnce(mockUser({ role: "BROADCASTER" }))
        .mockResolvedValueOnce({ ...mockUser({ id: "u2", name: "Alice" }), accounts: [{ providerId: "twitch", accountId: "t1" }] });
      const result = await caller.getUser({ userId: "u2" });
      expect(result.name).toBe("Alice");
      expect(result.connectedAccounts).toHaveLength(1);
    });

    it("throws NOT_FOUND for missing user", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(null);
      await expect(caller.getUser({ userId: "missing" })).rejects.toThrow("User not found");
    });
  });

  describe("updateRole", () => {
    it("updates role and logs audit", async () => {
      const caller = authedCaller();
      p.user.findUnique
        .mockResolvedValueOnce(mockUser({ role: "BROADCASTER" }))
        .mockResolvedValueOnce(mockUser({ id: "u2", role: "USER", name: "Target" }));
      p.user.update.mockResolvedValue({});
      const result = await caller.updateRole({ userId: "u2", role: "MODERATOR" });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "user.role-change",
        metadata: expect.objectContaining({ previousRole: "USER", newRole: "MODERATOR" }),
      }));
    });

    it("prevents changing own role", async () => {
      const caller = authedCaller();
      await expect(caller.updateRole({ userId: "user-1", role: "MODERATOR" })).rejects.toThrow("Cannot change your own role");
    });

    it("prevents changing broadcaster's role", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(mockUser({ id: "u2", role: "BROADCASTER" }));
      await expect(caller.updateRole({ userId: "u2", role: "USER" })).rejects.toThrow("Cannot change the broadcaster's role");
    });

    it("throws NOT_FOUND for missing user", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(null);
      await expect(caller.updateRole({ userId: "missing", role: "MODERATOR" })).rejects.toThrow("User not found");
    });
  });

  describe("ban", () => {
    it("bans user with reason", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(mockUser({ id: "u2", role: "USER", name: "Bad" }));
      p.user.update.mockResolvedValue({});
      const result = await caller.ban({ userId: "u2", reason: "Spam" });
      expect(result.success).toBe(true);
      expect(p.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: expect.objectContaining({ banned: true, banReason: "Spam" }) });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.ban" }));
    });

    it("prevents banning yourself", async () => {
      const caller = authedCaller();
      await expect(caller.ban({ userId: "user-1" })).rejects.toThrow("Cannot ban yourself");
    });

    it("prevents banning the broadcaster", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(mockUser({ id: "u2", role: "BROADCASTER" }));
      await expect(caller.ban({ userId: "u2" })).rejects.toThrow("Cannot ban the broadcaster");
    });
  });

  describe("unban", () => {
    it("unbans user and logs audit", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(mockUser({ id: "u2", banned: true, name: "Unbanned" }));
      p.user.update.mockResolvedValue({});
      const result = await caller.unban({ userId: "u2" });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.unban" }));
    });

    it("throws NOT_FOUND for missing user", async () => {
      const caller = authedCaller();
      p.user.findUnique.mockResolvedValueOnce(mockUser({ role: "BROADCASTER" })).mockResolvedValueOnce(null);
      await expect(caller.unban({ userId: "missing" })).rejects.toThrow("User not found");
    });
  });
});
