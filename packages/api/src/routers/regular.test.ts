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
  return {
    prisma: new Proxy(mp, handler),
    eventBus: { publish: vi.fn() },
    logAudit: vi.fn(),
    getTwitchUserByLogin: vi.fn(),
    getTwitchUserById: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("../utils/twitch", () => ({ getTwitchUserByLogin: mocks.getTwitchUserByLogin, getTwitchUserById: mocks.getTwitchUserById }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { regularRouter } from "./regular";

const createCaller = t.createCallerFactory(regularRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("regularRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns all regulars", async () => {
      const caller = createCaller(mockSession());
      p.twitchRegular.findMany.mockResolvedValue([{ id: "r1", twitchUsername: "viewer1" }]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });
  });

  describe("add", () => {
    it("adds a regular and publishes event", async () => {
      const caller = authedCaller();
      mocks.getTwitchUserByLogin.mockResolvedValue({ id: "twitch-1", display_name: "Viewer1" });
      p.twitchRegular.findUnique.mockResolvedValue(null);
      p.twitchRegular.create.mockResolvedValue({ id: "r1", twitchUserId: "twitch-1", twitchUsername: "Viewer1" });
      const result = await caller.add({ username: "Viewer1" });
      expect(result.twitchUsername).toBe("Viewer1");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("regular:created", { twitchUserId: "twitch-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "regular.add" }));
    });

    it("throws NOT_FOUND when Twitch user doesn't exist", async () => {
      const caller = authedCaller();
      mocks.getTwitchUserByLogin.mockResolvedValue(undefined);
      await expect(caller.add({ username: "nonexistent" })).rejects.toThrow("not found");
    });

    it("throws CONFLICT when already a regular", async () => {
      const caller = authedCaller();
      mocks.getTwitchUserByLogin.mockResolvedValue({ id: "twitch-1", display_name: "V1" });
      p.twitchRegular.findUnique.mockResolvedValue({ id: "existing" });
      await expect(caller.add({ username: "v1" })).rejects.toThrow("already a regular");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.add({ username: "test" })).rejects.toThrow();
    });
  });

  describe("remove", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("removes regular and publishes event", async () => {
      const caller = authedCaller();
      p.twitchRegular.findUnique.mockResolvedValue({ id: "r1", twitchUserId: "twitch-1", twitchUsername: "V1" });
      p.twitchRegular.delete.mockResolvedValue({});
      const result = await caller.remove({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("regular:deleted", { twitchUserId: "twitch-1" });
    });

    it("throws NOT_FOUND for missing regular", async () => {
      const caller = authedCaller();
      p.twitchRegular.findUnique.mockResolvedValue(null);
      await expect(caller.remove({ id: UUID })).rejects.toThrow("Regular not found");
    });
  });

  describe("refreshUsernames", () => {
    it("updates display names from Twitch", async () => {
      const caller = createCaller(mockSession());
      p.twitchRegular.findMany.mockResolvedValue([
        { id: "r1", twitchUserId: "t1", twitchUsername: "old_name" },
        { id: "r2", twitchUserId: "t2", twitchUsername: "same" },
      ]);
      mocks.getTwitchUserById.mockResolvedValueOnce({ display_name: "NewName" }).mockResolvedValueOnce({ display_name: "same" });
      p.twitchRegular.update.mockResolvedValue({});
      const result = await caller.refreshUsernames();
      expect(result.updated).toBe(1);
      expect(result.total).toBe(2);
    });
  });
});
