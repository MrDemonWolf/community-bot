import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isOnCooldown, recordUsage } from "./cooldownManager.js";

describe("cooldownManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isOnCooldown", () => {
    it("returns not on cooldown when no usage recorded", () => {
      const result = isOnCooldown("uniqueCmd1", "user1", 10, 5);
      expect(result).toEqual({ onCooldown: false, remainingSeconds: 0 });
    });

    it("detects global cooldown", () => {
      recordUsage("globalTest", "user1", 10, 0);
      const result = isOnCooldown("globalTest", "user2", 10, 0);
      expect(result.onCooldown).toBe(true);
      expect(result.remainingSeconds).toBe(10);
    });

    it("detects per-user cooldown", () => {
      recordUsage("userTest", "user1", 0, 5);
      const result = isOnCooldown("userTest", "user1", 0, 5);
      expect(result.onCooldown).toBe(true);
      expect(result.remainingSeconds).toBe(5);
    });

    it("does not apply user cooldown to a different user", () => {
      recordUsage("userTest2", "user1", 0, 5);
      const result = isOnCooldown("userTest2", "user2", 0, 5);
      expect(result.onCooldown).toBe(false);
    });

    it("expires after cooldown period", () => {
      recordUsage("expireTest", "user1", 10, 0);
      vi.advanceTimersByTime(10_000);
      const result = isOnCooldown("expireTest", "user1", 10, 0);
      expect(result.onCooldown).toBe(false);
    });

    it("returns correct remaining seconds mid-cooldown", () => {
      recordUsage("midTest", "user1", 10, 0);
      vi.advanceTimersByTime(3_000);
      const result = isOnCooldown("midTest", "user1", 10, 0);
      expect(result.onCooldown).toBe(true);
      expect(result.remainingSeconds).toBe(7);
    });

    it("global cooldown takes priority over user cooldown", () => {
      recordUsage("priorityTest", "user1", 10, 5);
      vi.advanceTimersByTime(6_000);
      // User CD (5s) expired, but global CD (10s) still active
      const result = isOnCooldown("priorityTest", "user1", 10, 5);
      expect(result.onCooldown).toBe(true);
      expect(result.remainingSeconds).toBe(4);
    });
  });

  describe("recordUsage", () => {
    it("does not set cooldown when values are 0", () => {
      recordUsage("noCd", "user1", 0, 0);
      const result = isOnCooldown("noCd", "user1", 0, 0);
      expect(result.onCooldown).toBe(false);
    });
  });
});
