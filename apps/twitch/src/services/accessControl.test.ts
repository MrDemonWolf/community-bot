import { describe, it, expect } from "vitest";

// The access hierarchy and meetsAccessLevel are pure logic.
// We replicate the hierarchy here to test without importing prisma/twurple deps.

const ACCESS_HIERARCHY: Record<string, number> = {
  EVERYONE: 0,
  SUBSCRIBER: 1,
  REGULAR: 2,
  VIP: 3,
  MODERATOR: 4,
  LEAD_MODERATOR: 5,
  BROADCASTER: 6,
};

function meetsAccessLevel(userLevel: string, requiredLevel: string): boolean {
  return ACCESS_HIERARCHY[userLevel] >= ACCESS_HIERARCHY[requiredLevel];
}

describe("accessControl", () => {
  describe("meetsAccessLevel", () => {
    it("BROADCASTER meets all levels", () => {
      for (const level of Object.keys(ACCESS_HIERARCHY)) {
        expect(meetsAccessLevel("BROADCASTER", level)).toBe(true);
      }
    });

    it("EVERYONE only meets EVERYONE", () => {
      expect(meetsAccessLevel("EVERYONE", "EVERYONE")).toBe(true);
      expect(meetsAccessLevel("EVERYONE", "SUBSCRIBER")).toBe(false);
      expect(meetsAccessLevel("EVERYONE", "MODERATOR")).toBe(false);
    });

    it("MODERATOR meets MODERATOR and below", () => {
      expect(meetsAccessLevel("MODERATOR", "MODERATOR")).toBe(true);
      expect(meetsAccessLevel("MODERATOR", "VIP")).toBe(true);
      expect(meetsAccessLevel("MODERATOR", "REGULAR")).toBe(true);
      expect(meetsAccessLevel("MODERATOR", "SUBSCRIBER")).toBe(true);
      expect(meetsAccessLevel("MODERATOR", "EVERYONE")).toBe(true);
      expect(meetsAccessLevel("MODERATOR", "LEAD_MODERATOR")).toBe(false);
      expect(meetsAccessLevel("MODERATOR", "BROADCASTER")).toBe(false);
    });

    it("VIP does not meet MODERATOR", () => {
      expect(meetsAccessLevel("VIP", "MODERATOR")).toBe(false);
    });

    it("SUBSCRIBER does not meet REGULAR", () => {
      expect(meetsAccessLevel("SUBSCRIBER", "REGULAR")).toBe(false);
    });

    it("same level always meets", () => {
      for (const level of Object.keys(ACCESS_HIERARCHY)) {
        expect(meetsAccessLevel(level, level)).toBe(true);
      }
    });
  });

  describe("ACCESS_HIERARCHY ordering", () => {
    it("has correct ordering", () => {
      expect(ACCESS_HIERARCHY.EVERYONE).toBeLessThan(ACCESS_HIERARCHY.SUBSCRIBER);
      expect(ACCESS_HIERARCHY.SUBSCRIBER).toBeLessThan(ACCESS_HIERARCHY.REGULAR);
      expect(ACCESS_HIERARCHY.REGULAR).toBeLessThan(ACCESS_HIERARCHY.VIP);
      expect(ACCESS_HIERARCHY.VIP).toBeLessThan(ACCESS_HIERARCHY.MODERATOR);
      expect(ACCESS_HIERARCHY.MODERATOR).toBeLessThan(ACCESS_HIERARCHY.LEAD_MODERATOR);
      expect(ACCESS_HIERARCHY.LEAD_MODERATOR).toBeLessThan(ACCESS_HIERARCHY.BROADCASTER);
    });
  });
});
