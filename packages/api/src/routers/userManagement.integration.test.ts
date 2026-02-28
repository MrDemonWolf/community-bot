import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
} from "@community-bot/db/test-client";

vi.mock("../utils/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({
  env: { REDIS_URL: "redis://localhost" },
}));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { userManagementRouter } from "./userManagement";

const createCaller = t.createCallerFactory(userManagementRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "Broadcaster", image: null, email: "b@t.t" } },
  };
}

describe("userManagementRouter (integration)", () => {
  let broadcaster: Awaited<ReturnType<typeof seedUser>>;
  let target: Awaited<ReturnType<typeof seedUser>>;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    broadcaster = await seedUser(testPrisma, {
      id: "broadcaster-1",
      role: "BROADCASTER",
    });
    target = await seedUser(testPrisma, {
      id: "target-1",
      name: "TargetUser",
      role: "USER",
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  function authedCaller() {
    return createCaller(session(broadcaster.id));
  }

  describe("updateRole", () => {
    it("changes a user's role in the database", async () => {
      const caller = authedCaller();
      await caller.updateRole({ userId: target.id, role: "MODERATOR" });

      const dbUser = await testPrisma.user.findUnique({
        where: { id: target.id },
      });
      expect(dbUser!.role).toBe("MODERATOR");
    });

    it("rejects changing own role", async () => {
      const caller = authedCaller();
      await expect(
        caller.updateRole({ userId: broadcaster.id, role: "MODERATOR" })
      ).rejects.toThrow("Cannot change your own role");
    });

    it("rejects changing broadcaster role", async () => {
      const otherBroadcaster = await seedUser(testPrisma, {
        id: "other-bc",
        role: "BROADCASTER",
      });
      const caller = authedCaller();
      await expect(
        caller.updateRole({ userId: otherBroadcaster.id, role: "USER" })
      ).rejects.toThrow("broadcaster");
    });
  });

  describe("ban", () => {
    it("bans a user with reason in the database", async () => {
      const caller = authedCaller();
      await caller.ban({ userId: target.id, reason: "Breaking rules" });

      const dbUser = await testPrisma.user.findUnique({
        where: { id: target.id },
      });
      expect(dbUser!.banned).toBe(true);
      expect(dbUser!.banReason).toBe("Breaking rules");
      expect(dbUser!.bannedAt).not.toBeNull();
    });

    it("rejects self-ban", async () => {
      const caller = authedCaller();
      await expect(
        caller.ban({ userId: broadcaster.id })
      ).rejects.toThrow("Cannot ban yourself");
    });
  });

  describe("unban", () => {
    it("unbans a user and clears ban fields", async () => {
      // Ban first
      await testPrisma.user.update({
        where: { id: target.id },
        data: { banned: true, bannedAt: new Date(), banReason: "Test" },
      });

      const caller = authedCaller();
      await caller.unban({ userId: target.id });

      const dbUser = await testPrisma.user.findUnique({
        where: { id: target.id },
      });
      expect(dbUser!.banned).toBe(false);
      expect(dbUser!.bannedAt).toBeNull();
      expect(dbUser!.banReason).toBeNull();
    });
  });
});
