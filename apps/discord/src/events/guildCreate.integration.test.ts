import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedDiscordGuild,
} from "@community-bot/db/test-client";

vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});
vi.mock("../utils/logger.js", () => ({
  default: {
    discord: { guildJoined: vi.fn(), guildLeft: vi.fn() },
    database: { operation: vi.fn() },
    error: vi.fn(),
  },
}));

import { guildCreateEvent } from "./guildCreate.js";
import { guildDeleteEvent } from "./guildDelete.js";
import type { Guild } from "discord.js";

function fakeGuild(overrides: Partial<Guild> = {}): Guild {
  return {
    id: "guild-123",
    name: "Test Guild",
    icon: "icon_hash",
    memberCount: 42,
    ...overrides,
  } as unknown as Guild;
}

describe("guildCreate / guildDelete (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  describe("guildCreateEvent", () => {
    it("creates a DiscordGuild record in the database", async () => {
      await guildCreateEvent(fakeGuild({ id: "g-1", name: "My Guild" }));

      const guild = await testPrisma.discordGuild.findUnique({
        where: { guildId: "g-1" },
      });
      expect(guild).not.toBeNull();
      expect(guild!.name).toBe("My Guild");
    });

    it("handles duplicate guild gracefully (logs error, no crash)", async () => {
      await seedDiscordGuild(testPrisma, { guildId: "g-dup", name: "Existing" });

      // Should not throw — the function catches errors internally
      await guildCreateEvent(fakeGuild({ id: "g-dup", name: "Duplicate" }));

      // Original record should still exist
      const guild = await testPrisma.discordGuild.findUnique({
        where: { guildId: "g-dup" },
      });
      expect(guild).not.toBeNull();
    });
  });

  describe("guildDeleteEvent", () => {
    it("removes the DiscordGuild record from the database", async () => {
      await seedDiscordGuild(testPrisma, { guildId: "g-del", name: "DeleteMe" });

      await guildDeleteEvent(fakeGuild({ id: "g-del", name: "DeleteMe" }));

      const guild = await testPrisma.discordGuild.findUnique({
        where: { guildId: "g-del" },
      });
      expect(guild).toBeNull();
    });

    it("handles delete of non-existent guild gracefully", async () => {
      // Should not throw
      await guildDeleteEvent(
        fakeGuild({ id: "nonexistent", name: "Ghost" })
      );
    });
  });

  describe("round-trip: create → delete → re-create", () => {
    it("re-creates guild after deletion", async () => {
      await guildCreateEvent(fakeGuild({ id: "g-rt", name: "Round Trip" }));
      await guildDeleteEvent(fakeGuild({ id: "g-rt", name: "Round Trip" }));
      await guildCreateEvent(fakeGuild({ id: "g-rt", name: "Round Trip v2" }));

      const guild = await testPrisma.discordGuild.findUnique({
        where: { guildId: "g-rt" },
      });
      expect(guild).not.toBeNull();
      expect(guild!.name).toBe("Round Trip v2");
    });
  });
});
