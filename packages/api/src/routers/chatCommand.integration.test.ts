import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
  seedBotChannel,
  seedCommand,
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
import { chatCommandRouter } from "./chatCommand";

const createCaller = t.createCallerFactory(chatCommandRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "Test", image: null, email: "t@t.t" } },
  };
}

describe("chatCommandRouter (integration)", () => {
  let user: Awaited<ReturnType<typeof seedUser>>;
  let botChannel: Awaited<ReturnType<typeof seedBotChannel>>;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    user = await seedUser(testPrisma, { id: "user-1", role: "BROADCASTER" });
    botChannel = await seedBotChannel(testPrisma, { userId: user.id });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  function authedCaller(userId = user.id) {
    return createCaller(session(userId));
  }

  describe("create", () => {
    it("creates a command in the real database", async () => {
      const caller = authedCaller();
      const cmd = await caller.create({
        name: "hello",
        response: "Hello world!",
      });

      expect(cmd.name).toBe("hello");
      expect(cmd.botChannelId).toBe(botChannel.id);

      const dbCmd = await testPrisma.twitchChatCommand.findUnique({
        where: { id: cmd.id },
      });
      expect(dbCmd).not.toBeNull();
      expect(dbCmd!.response).toBe("Hello world!");
    });

    it("rejects duplicate command names (compound unique)", async () => {
      const caller = authedCaller();
      await caller.create({ name: "greet", response: "Hi!" });

      await expect(
        caller.create({ name: "greet", response: "Hey!" })
      ).rejects.toThrow("already exists");
    });

    it("rejects built-in command names", async () => {
      const caller = authedCaller();
      await expect(
        caller.create({ name: "ping", response: "pong" })
      ).rejects.toThrow("built-in");
    });

    it("lowercases name and aliases", async () => {
      const caller = authedCaller();
      const cmd = await caller.create({
        name: "MyCmd",
        response: "test",
        aliases: ["ALIAS1", "Alias2"],
      });

      expect(cmd.name).toBe("mycmd");
      expect(cmd.aliases).toEqual(["alias1", "alias2"]);
    });
  });

  describe("list", () => {
    it("returns only commands for the user's bot channel", async () => {
      const caller = authedCaller();
      await seedCommand(testPrisma, {
        botChannelId: botChannel.id,
        name: "cmd1",
      });
      await seedCommand(testPrisma, {
        botChannelId: botChannel.id,
        name: "cmd2",
      });

      // Create another user with different bot channel
      const user2 = await seedUser(testPrisma, { id: "user-2", role: "BROADCASTER" });
      const bc2 = await seedBotChannel(testPrisma, { userId: user2.id });
      await seedCommand(testPrisma, {
        botChannelId: bc2.id,
        name: "othercmd",
      });

      const commands = await caller.list();
      expect(commands).toHaveLength(2);
      expect(commands.every((c) => c.botChannelId === botChannel.id)).toBe(true);
    });
  });

  describe("update", () => {
    it("updates command fields in the database", async () => {
      const caller = authedCaller();
      const cmd = await caller.create({
        name: "testcmd",
        response: "original",
      });

      const updated = await caller.update({
        id: cmd.id,
        response: "updated response",
        accessLevel: "MODERATOR",
      });

      expect(updated.response).toBe("updated response");
      expect(updated.accessLevel).toBe("MODERATOR");
    });

    it("throws NOT_FOUND for command from different channel", async () => {
      const user2 = await seedUser(testPrisma, { id: "user-2", role: "BROADCASTER" });
      const bc2 = await seedBotChannel(testPrisma, { userId: user2.id });
      const otherCmd = await seedCommand(testPrisma, {
        botChannelId: bc2.id,
        name: "other",
      });

      const caller = authedCaller();
      await expect(
        caller.update({ id: otherCmd.id, response: "hacked" })
      ).rejects.toThrow("Command not found");
    });
  });

  describe("delete", () => {
    it("removes command from the database", async () => {
      const caller = authedCaller();
      const cmd = await caller.create({
        name: "deleteme",
        response: "bye",
      });

      await caller.delete({ id: cmd.id });

      const dbCmd = await testPrisma.twitchChatCommand.findUnique({
        where: { id: cmd.id },
      });
      expect(dbCmd).toBeNull();
    });
  });

  describe("toggleEnabled", () => {
    it("flips the enabled flag", async () => {
      const caller = authedCaller();
      const cmd = await caller.create({
        name: "toggleme",
        response: "test",
      });
      expect(cmd.enabled).toBe(true);

      const toggled = await caller.toggleEnabled({ id: cmd.id });
      expect(toggled.enabled).toBe(false);

      const toggledBack = await caller.toggleEnabled({ id: cmd.id });
      expect(toggledBack.enabled).toBe(true);
    });
  });
});
