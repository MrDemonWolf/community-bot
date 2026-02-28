import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
  seedBotChannel,
  seedAccount,
} from "@community-bot/db/test-client";

vi.mock("../events", () => ({ eventBus: { publish: vi.fn() } }));
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
import { botChannelRouter } from "./botChannel";

const createCaller = t.createCallerFactory(botChannelRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "TestBroadcaster", image: null, email: "t@t.t" } },
  };
}

describe("botChannelRouter (integration)", () => {
  let user: Awaited<ReturnType<typeof seedUser>>;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    user = await seedUser(testPrisma, {
      id: "user-1",
      name: "testbroadcaster",
      role: "BROADCASTER",
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  function authedCaller(userId = user.id) {
    return createCaller(session(userId));
  }

  describe("getStatus", () => {
    it("returns no bot channel when not enabled", async () => {
      const caller = authedCaller();
      const status = await caller.getStatus();
      expect(status.botChannel).toBeNull();
      expect(status.hasTwitchLinked).toBe(false);
    });

    it("returns bot channel status when enabled", async () => {
      await seedAccount(testPrisma, { userId: user.id, providerId: "twitch" });
      await seedBotChannel(testPrisma, { userId: user.id });

      const caller = authedCaller();
      const status = await caller.getStatus();
      expect(status.hasTwitchLinked).toBe(true);
      expect(status.botChannel).not.toBeNull();
      expect(status.botChannel!.enabled).toBe(true);
    });
  });

  describe("enable", () => {
    it("creates a BotChannel record in the database", async () => {
      await seedAccount(testPrisma, {
        userId: user.id,
        providerId: "twitch",
        accountId: "twitch_123",
      });

      const caller = authedCaller();
      const result = await caller.enable();
      expect(result.success).toBe(true);

      const bc = await testPrisma.botChannel.findUnique({
        where: { userId: user.id },
      });
      expect(bc).not.toBeNull();
      expect(bc!.enabled).toBe(true);
    });

    it("re-enables a previously disabled bot channel", async () => {
      await seedAccount(testPrisma, { userId: user.id, providerId: "twitch" });
      await seedBotChannel(testPrisma, { userId: user.id, enabled: false });

      const caller = authedCaller();
      await caller.enable();

      const bc = await testPrisma.botChannel.findUnique({
        where: { userId: user.id },
      });
      expect(bc!.enabled).toBe(true);
    });
  });

  describe("disable", () => {
    it("sets enabled to false in the database", async () => {
      await seedAccount(testPrisma, { userId: user.id, providerId: "twitch" });
      await seedBotChannel(testPrisma, { userId: user.id });

      const caller = authedCaller();
      await caller.disable();

      const bc = await testPrisma.botChannel.findUnique({
        where: { userId: user.id },
      });
      expect(bc!.enabled).toBe(false);
    });
  });

  describe("updateCommandToggles", () => {
    it("updates disabledCommands array in the database", async () => {
      await seedAccount(testPrisma, { userId: user.id, providerId: "twitch" });
      await seedBotChannel(testPrisma, { userId: user.id });

      const caller = authedCaller();
      await caller.updateCommandToggles({
        disabledCommands: ["ping", "uptime"],
      });

      const bc = await testPrisma.botChannel.findUnique({
        where: { userId: user.id },
      });
      expect(bc!.disabledCommands).toEqual(["ping", "uptime"]);
    });
  });

  describe("updateCommandAccessLevel", () => {
    it("creates a DefaultCommandOverride in the database", async () => {
      await seedAccount(testPrisma, { userId: user.id, providerId: "twitch" });
      const bc = await seedBotChannel(testPrisma, { userId: user.id });

      const caller = authedCaller();
      await caller.updateCommandAccessLevel({
        commandName: "ping",
        accessLevel: "MODERATOR",
      });

      const override = await testPrisma.defaultCommandOverride.findFirst({
        where: { botChannelId: bc.id, commandName: "ping" },
      });
      expect(override).not.toBeNull();
      expect(override!.accessLevel).toBe("MODERATOR");
    });

    it("deletes override when reverting to default access level", async () => {
      await seedAccount(testPrisma, { userId: user.id, providerId: "twitch" });
      const bc = await seedBotChannel(testPrisma, { userId: user.id });

      const caller = authedCaller();
      // Ping's default is EVERYONE — set to MODERATOR first, then revert
      await caller.updateCommandAccessLevel({
        commandName: "ping",
        accessLevel: "MODERATOR",
      });

      await caller.updateCommandAccessLevel({
        commandName: "ping",
        accessLevel: "EVERYONE",
      });

      const override = await testPrisma.defaultCommandOverride.findFirst({
        where: { botChannelId: bc.id, commandName: "ping" },
      });
      expect(override).toBeNull();
    });
  });
});
