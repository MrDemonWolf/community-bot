import { describe, expect, test } from "bun:test";
import {
  connectionAction,
  connectionKey,
  formatDuration,
  parseCommand,
  retryDelay,
  shouldRespond,
} from "./commands";

describe("Twitch commands", () => {
  test("connection retries back off and remain capped", () => {
    expect([1, 2, 3, 4, 5, 100].map(retryDelay)).toEqual([
      5000, 10000, 20000, 40000, 60000, 60000,
    ]);
  });
  test("only recognizes configured prefix and supported commands", () => {
    expect(parseCommand("!UPTIME", "!")).toBe("uptime");
    expect(parseCommand("?streamuptime extra", "?")).toBe("streamuptime");
    expect(parseCommand("hello !uptime", "!")).toBeNull();
    expect(parseCommand("!uptime", "")).toBeNull();
    expect(parseCommand("!unknown", "!")).toBeNull();
  });
  test("formats real durations and clamps negatives", () => {
    expect(formatDuration(90061.8)).toBe("1d 1h 1m 1s");
    expect(formatDuration(-2)).toBe("0s");
  });
  test("mute, leave, echoes, shared-chat and cooldown suppress responses", () => {
    const input = {
      enabled: true,
      muted: false,
      chatterId: "viewer",
      botId: "bot",
      broadcasterId: "channel",
      channelId: "channel",
      sourceBroadcasterId: null,
      now: 5000,
      lastResponse: 0,
    };
    expect(shouldRespond(input)).toBe(true);
    for (const change of [
      { muted: true },
      { enabled: false },
      { chatterId: "bot" },
      { broadcasterId: "other" },
      { sourceBroadcasterId: "other" },
      { now: 2000 },
    ]) {
      expect(shouldRespond({ ...input, ...change })).toBe(false);
    }
  });
  test("connection changes include credentials and channel, not presentation", () => {
    const settings = {
      twitchClientId: "app",
      twitchClientSecretEnc: "secret",
      botUserId: "bot",
      botTokenEnc: "token",
      broadcasterUserId: "channel",
    };
    expect(connectionKey(settings)).not.toBe(
      connectionKey({ ...settings, botTokenEnc: "new" }),
    );
    expect(connectionKey(settings)).not.toBe(
      connectionKey({ ...settings, broadcasterUserId: "new" }),
    );
    expect(connectionKey(settings)).not.toBe(
      connectionKey({ ...settings, broadcasterTokenEnc: "new" }),
    );
  });
  test("reconciles leave, incomplete setup, join, credential replacement and failure", () => {
    expect(connectionAction(false, true, "same", "same", false)).toBe("stop");
    expect(connectionAction(true, false, "same", "same", false)).toBe("wait");
    expect(connectionAction(true, true, null, "new", false)).toBe("connect");
    expect(connectionAction(true, true, "old", "new", false)).toBe("connect");
    expect(connectionAction(true, true, "same", "same", true)).toBe("connect");
    expect(connectionAction(true, true, "same", "same", false)).toBe("keep");
  });
});
