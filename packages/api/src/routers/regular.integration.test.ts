import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
} from "@community-bot/db/test-client";

const mocks = vi.hoisted(() => ({
  getTwitchUserByLogin: vi.fn(),
  getTwitchUserById: vi.fn(),
}));

vi.mock("../events", () => ({ eventBus: { publish: vi.fn() } }));
vi.mock("../utils/audit", () => ({ logAudit: vi.fn() }));
vi.mock("../utils/twitch", () => ({
  getTwitchUserByLogin: mocks.getTwitchUserByLogin,
  getTwitchUserById: mocks.getTwitchUserById,
}));
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
import { regularRouter } from "./regular";

const createCaller = t.createCallerFactory(regularRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "Test", image: null, email: "t@t.t" } },
  };
}

describe("regularRouter (integration)", () => {
  let broadcaster: Awaited<ReturnType<typeof seedUser>>;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    vi.clearAllMocks();
    broadcaster = await seedUser(testPrisma, {
      id: "user-1",
      role: "BROADCASTER",
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  function authedCaller(userId = broadcaster.id) {
    return createCaller(session(userId));
  }

  describe("add", () => {
    it("creates a TwitchRegular in the database", async () => {
      mocks.getTwitchUserByLogin.mockResolvedValue({
        id: "twitch-42",
        display_name: "CoolViewer",
      });

      const caller = authedCaller();
      const regular = await caller.add({ username: "coolviewer" });

      expect(regular.twitchUserId).toBe("twitch-42");
      expect(regular.twitchUsername).toBe("CoolViewer");

      const dbRegular = await testPrisma.twitchRegular.findUnique({
        where: { twitchUserId: "twitch-42" },
      });
      expect(dbRegular).not.toBeNull();
    });

    it("rejects duplicate regular (unique constraint)", async () => {
      mocks.getTwitchUserByLogin.mockResolvedValue({
        id: "twitch-42",
        display_name: "CoolViewer",
      });

      const caller = authedCaller();
      await caller.add({ username: "coolviewer" });

      await expect(caller.add({ username: "coolviewer" })).rejects.toThrow(
        "already a regular"
      );
    });

    it("throws NOT_FOUND for unknown Twitch user", async () => {
      mocks.getTwitchUserByLogin.mockResolvedValue(null);
      const caller = authedCaller();
      await expect(caller.add({ username: "nobody" })).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("remove", () => {
    it("deletes the regular from the database", async () => {
      const regular = await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "twitch-99",
          twitchUsername: "RemoveMe",
          addedBy: "test",
        },
      });

      const caller = authedCaller();
      const result = await caller.remove({ id: regular.id });
      expect(result.success).toBe(true);

      const dbRegular = await testPrisma.twitchRegular.findUnique({
        where: { id: regular.id },
      });
      expect(dbRegular).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all regulars ordered by createdAt desc", async () => {
      await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "t1",
          twitchUsername: "First",
          addedBy: "test",
          createdAt: new Date("2024-01-01"),
        },
      });
      await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "t2",
          twitchUsername: "Second",
          addedBy: "test",
          createdAt: new Date("2024-06-01"),
        },
      });

      const caller = authedCaller();
      const regulars = await caller.list();
      expect(regulars).toHaveLength(2);
      expect(regulars[0].twitchUsername).toBe("Second");
    });
  });
});
