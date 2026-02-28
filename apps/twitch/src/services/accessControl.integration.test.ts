import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
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

import { loadRegulars, isRegular } from "./accessControl.js";
import { meetsAccessLevel } from "./accessControl.constants.js";

describe("accessControl (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  describe("loadRegulars", () => {
    it("loads regulars from the real database", async () => {
      await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "reg-1",
          twitchUsername: "Regular1",
          addedBy: "test",
        },
      });
      await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "reg-2",
          twitchUsername: "Regular2",
          addedBy: "test",
        },
      });

      await loadRegulars();

      expect(isRegular("reg-1")).toBe(true);
      expect(isRegular("reg-2")).toBe(true);
      expect(isRegular("nonexistent")).toBe(false);
    });

    it("refreshes when new regulars are added", async () => {
      await loadRegulars();
      expect(isRegular("new-reg")).toBe(false);

      await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "new-reg",
          twitchUsername: "NewRegular",
          addedBy: "test",
        },
      });

      await loadRegulars();
      expect(isRegular("new-reg")).toBe(true);
    });

    it("removes regulars that were deleted from DB", async () => {
      const regular = await testPrisma.twitchRegular.create({
        data: {
          twitchUserId: "temp-reg",
          twitchUsername: "TempReg",
          addedBy: "test",
        },
      });

      await loadRegulars();
      expect(isRegular("temp-reg")).toBe(true);

      await testPrisma.twitchRegular.delete({ where: { id: regular.id } });

      await loadRegulars();
      expect(isRegular("temp-reg")).toBe(false);
    });
  });

  describe("meetsAccessLevel", () => {
    it("EVERYONE meets EVERYONE", () => {
      expect(meetsAccessLevel("EVERYONE", "EVERYONE")).toBe(true);
    });

    it("REGULAR meets EVERYONE and REGULAR but not MODERATOR", () => {
      expect(meetsAccessLevel("REGULAR", "EVERYONE")).toBe(true);
      expect(meetsAccessLevel("REGULAR", "REGULAR")).toBe(true);
      expect(meetsAccessLevel("REGULAR", "MODERATOR")).toBe(false);
    });

    it("BROADCASTER meets all levels", () => {
      expect(meetsAccessLevel("BROADCASTER", "EVERYONE")).toBe(true);
      expect(meetsAccessLevel("BROADCASTER", "SUBSCRIBER")).toBe(true);
      expect(meetsAccessLevel("BROADCASTER", "MODERATOR")).toBe(true);
      expect(meetsAccessLevel("BROADCASTER", "BROADCASTER")).toBe(true);
    });

    it("EVERYONE does not meet SUBSCRIBER", () => {
      expect(meetsAccessLevel("EVERYONE", "SUBSCRIBER")).toBe(false);
    });
  });
});
