import { describe, expect, test } from "bun:test";
import { COMMANDS } from "@community-bot/core/commands";
import { commandRegistration, streamStart } from "./commands";

describe("Discord command integration", () => {
  test("publishes the shared catalog and removes it when disabled", () => {
    expect(commandRegistration(true).map((command) => command.name)).toEqual(COMMANDS);
    expect(commandRegistration(true).every((command) => command.description.length <= 100)).toBe(true);
    expect(commandRegistration(false)).toEqual([]);
  });
  test("distinguishes offline from unavailable Twitch runtime evidence", () => {
    expect(streamStart({ stale: false, metadata: { live: false } })).toBeNull();
    expect(streamStart({ stale: false, metadata: { live: true, streamStartedAt: "2026-10-15T12:00:00.000Z" } })?.toISOString()).toBe("2026-10-15T12:00:00.000Z");
    for (const runtime of [undefined, { stale: true, metadata: { live: false } }, { stale: false, metadata: {} }, { stale: false, metadata: { live: true, streamStartedAt: "invalid" } }]) {
      expect(() => streamStart(runtime)).toThrow();
    }
  });
});
