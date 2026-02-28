import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
} from "@community-bot/db/test-client";

vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({
  env: {
    REDIS_URL: "redis://localhost",
    TWITCH_APPLICATION_CLIENT_ID: "test-client-id",
  },
}));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { setupRouter } from "./setup";

const createCaller = t.createCallerFactory(setupRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "Test", image: null, email: "t@t.t" } },
  };
}

describe("setupRouter (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  describe("status", () => {
    it("returns setupComplete: false when no config exists", async () => {
      const caller = createCaller({ session: null });
      const result = await caller.status();
      expect(result.setupComplete).toBe(false);
    });

    it("returns setupComplete: true when configured", async () => {
      await testPrisma.systemConfig.create({
        data: { key: "setupComplete", value: "true" },
      });

      const caller = createCaller({ session: null });
      const result = await caller.status();
      expect(result.setupComplete).toBe(true);
    });
  });

  describe("complete", () => {
    it("finalizes setup with valid token", async () => {
      const user = await seedUser(testPrisma, { id: "setup-user", role: "USER" });
      await testPrisma.systemConfig.create({
        data: { key: "setupToken", value: "valid-token-123" },
      });

      const caller = createCaller(session(user.id));
      const result = await caller.complete({ token: "valid-token-123" });
      expect(result.success).toBe(true);

      // Verify broadcaster is set
      const bcConfig = await testPrisma.systemConfig.findUnique({
        where: { key: "broadcasterUserId" },
      });
      expect(bcConfig!.value).toBe(user.id);

      // Verify setup complete
      const completeConfig = await testPrisma.systemConfig.findUnique({
        where: { key: "setupComplete" },
      });
      expect(completeConfig!.value).toBe("true");

      // Verify token deleted
      const tokenConfig = await testPrisma.systemConfig.findUnique({
        where: { key: "setupToken" },
      });
      expect(tokenConfig).toBeNull();

      // Verify user promoted to BROADCASTER
      const dbUser = await testPrisma.user.findUnique({
        where: { id: user.id },
      });
      expect(dbUser!.role).toBe("BROADCASTER");
    });

    it("rejects invalid token", async () => {
      const user = await seedUser(testPrisma, { id: "setup-user", role: "USER" });
      await testPrisma.systemConfig.create({
        data: { key: "setupToken", value: "real-token" },
      });

      const caller = createCaller(session(user.id));
      await expect(
        caller.complete({ token: "wrong-token" })
      ).rejects.toThrow("Invalid setup token");
    });
  });
});
