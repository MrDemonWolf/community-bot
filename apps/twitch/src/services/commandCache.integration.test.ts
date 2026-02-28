import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
  seedBotChannel,
  seedCommand,
} from "@community-bot/db/test-client";

vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { commandCache } from "./commandCache.js";

describe("commandCache (integration)", () => {
  let botChannelId: string;
  let channelUsername: string;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);

    const user = await seedUser(testPrisma, { id: "user-1", role: "BROADCASTER" });
    const bc = await seedBotChannel(testPrisma, {
      userId: user.id,
      twitchUsername: "teststreamer",
    });
    botChannelId = bc.id;
    channelUsername = bc.twitchUsername;
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  describe("load", () => {
    it("loads enabled commands from the database", async () => {
      await seedCommand(testPrisma, {
        botChannelId,
        name: "hello",
        response: "Hi!",
      });
      await seedCommand(testPrisma, {
        botChannelId,
        name: "bye",
        response: "Goodbye!",
      });

      await commandCache.load();

      const cmd = commandCache.getByNameOrAlias("hello", channelUsername);
      expect(cmd).toBeDefined();
      expect(cmd!.response).toBe("Hi!");
    });

    it("skips disabled commands", async () => {
      await seedCommand(testPrisma, {
        botChannelId,
        name: "active",
        response: "yes",
        enabled: true,
      });
      await seedCommand(testPrisma, {
        botChannelId,
        name: "inactive",
        response: "no",
        enabled: false,
      });

      await commandCache.load();

      expect(
        commandCache.getByNameOrAlias("active", channelUsername)
      ).toBeDefined();
      expect(
        commandCache.getByNameOrAlias("inactive", channelUsername)
      ).toBeUndefined();
    });
  });

  describe("getByNameOrAlias", () => {
    it("finds command by name (case-insensitive)", async () => {
      await seedCommand(testPrisma, {
        botChannelId,
        name: "greet",
        response: "Hello!",
      });
      await commandCache.load();

      expect(
        commandCache.getByNameOrAlias("GREET", channelUsername)
      ).toBeDefined();
      expect(
        commandCache.getByNameOrAlias("greet", channelUsername)
      ).toBeDefined();
    });

    it("finds command by alias", async () => {
      await seedCommand(testPrisma, {
        botChannelId,
        name: "greeting",
        response: "Hi!",
        aliases: ["hi", "hey"],
      });
      await commandCache.load();

      const cmd = commandCache.getByNameOrAlias("hi", channelUsername);
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe("greeting");

      expect(
        commandCache.getByNameOrAlias("hey", channelUsername)
      ).toBeDefined();
    });

    it("returns undefined for non-existent command", async () => {
      await commandCache.load();
      expect(
        commandCache.getByNameOrAlias("nope", channelUsername)
      ).toBeUndefined();
    });
  });

  describe("getRegexCommands", () => {
    it("returns regex-type commands for a channel", async () => {
      await seedCommand(testPrisma, {
        botChannelId,
        name: "link_filter",
        response: "No links!",
        regex: "https?://",
      });
      await seedCommand(testPrisma, {
        botChannelId,
        name: "normal",
        response: "normal cmd",
      });

      await commandCache.load();

      const regexCmds = commandCache.getRegexCommands(channelUsername);
      expect(regexCmds).toHaveLength(1);
      expect(regexCmds[0].name).toBe("link_filter");
      expect(regexCmds[0].compiledRegex).toBeInstanceOf(RegExp);
    });
  });

  describe("reload", () => {
    it("refreshes the cache after DB changes", async () => {
      await seedCommand(testPrisma, {
        botChannelId,
        name: "original",
        response: "v1",
      });
      await commandCache.load();

      expect(
        commandCache.getByNameOrAlias("original", channelUsername)
      ).toBeDefined();

      // Add a new command directly to DB
      await seedCommand(testPrisma, {
        botChannelId,
        name: "newcmd",
        response: "v2",
      });

      // Not visible yet
      expect(
        commandCache.getByNameOrAlias("newcmd", channelUsername)
      ).toBeUndefined();

      await commandCache.reload();

      // Now visible
      expect(
        commandCache.getByNameOrAlias("newcmd", channelUsername)
      ).toBeDefined();
    });
  });

  describe("multi-channel isolation", () => {
    it("separates commands per channel", async () => {
      const user2 = await seedUser(testPrisma, { id: "user-2", role: "BROADCASTER" });
      const bc2 = await seedBotChannel(testPrisma, {
        userId: user2.id,
        twitchUsername: "otherstreamer",
      });

      await seedCommand(testPrisma, {
        botChannelId,
        name: "sharedname",
        response: "channel 1 response",
      });
      await seedCommand(testPrisma, {
        botChannelId: bc2.id,
        name: "sharedname",
        response: "channel 2 response",
      });

      await commandCache.load();

      const cmd1 = commandCache.getByNameOrAlias("sharedname", channelUsername);
      expect(cmd1!.response).toBe("channel 1 response");

      const cmd2 = commandCache.getByNameOrAlias(
        "sharedname",
        bc2.twitchUsername
      );
      expect(cmd2!.response).toBe("channel 2 response");
    });
  });
});
