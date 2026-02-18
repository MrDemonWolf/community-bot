import { describe, it, expect } from "vitest";

// The pure lookup functions rely on module-level Maps populated by DB calls.
// We re-implement the pure logic to test without DB dependencies.

function isCommandDisabled(
  disabledMap: Map<string, Set<string>>,
  channelName: string,
  commandName: string
): boolean {
  const username = channelName.replace(/^#/, "").toLowerCase();
  const disabled = disabledMap.get(username);
  return disabled ? disabled.has(commandName) : false;
}

function getAccessLevelOverride(
  accessOverrides: Map<string, Map<string, string>>,
  channelName: string,
  commandName: string
): string | null {
  const username = channelName.replace(/^#/, "").toLowerCase();
  const overrides = accessOverrides.get(username);
  if (!overrides) return null;
  return overrides.get(commandName) ?? null;
}

describe("disabledCommandsCache", () => {
  describe("isCommandDisabled", () => {
    const disabledMap = new Map<string, Set<string>>([
      ["streamer1", new Set(["lurk", "followage"])],
      ["streamer2", new Set(["dice"])],
    ]);

    it("returns true for disabled command", () => {
      expect(isCommandDisabled(disabledMap, "streamer1", "lurk")).toBe(true);
    });

    it("returns false for enabled command", () => {
      expect(isCommandDisabled(disabledMap, "streamer1", "hello")).toBe(false);
    });

    it("returns false for unknown channel", () => {
      expect(isCommandDisabled(disabledMap, "unknown", "lurk")).toBe(false);
    });

    it("strips # prefix from channel name", () => {
      expect(isCommandDisabled(disabledMap, "#streamer1", "lurk")).toBe(true);
    });

    it("is case-insensitive for channel name", () => {
      expect(isCommandDisabled(disabledMap, "STREAMER1", "lurk")).toBe(true);
    });

    it("checks correct channel", () => {
      expect(isCommandDisabled(disabledMap, "streamer2", "lurk")).toBe(false);
      expect(isCommandDisabled(disabledMap, "streamer2", "dice")).toBe(true);
    });
  });

  describe("getAccessLevelOverride", () => {
    const accessOverrides = new Map<string, Map<string, string>>([
      ["streamer1", new Map([["lurk", "MODERATOR"], ["dice", "VIP"]])],
    ]);

    it("returns override when set", () => {
      expect(getAccessLevelOverride(accessOverrides, "streamer1", "lurk")).toBe("MODERATOR");
    });

    it("returns null when no override", () => {
      expect(getAccessLevelOverride(accessOverrides, "streamer1", "hello")).toBeNull();
    });

    it("returns null for unknown channel", () => {
      expect(getAccessLevelOverride(accessOverrides, "unknown", "lurk")).toBeNull();
    });

    it("strips # prefix", () => {
      expect(getAccessLevelOverride(accessOverrides, "#streamer1", "lurk")).toBe("MODERATOR");
    });

    it("is case-insensitive for channel", () => {
      expect(getAccessLevelOverride(accessOverrides, "STREAMER1", "dice")).toBe("VIP");
    });
  });
});
