import { describe, expect, test } from "bun:test";
import { ActivityType } from "discord.js";
import { presence, validateIdentity } from "./config";

const settings = {
  discordApplicationId: "1459804884466405501",
  discordGuildId: "127607669103001600",
  discordStatus: "online",
  discordActivityType: "watching",
  discordActivityText: "the community",
};

describe("Discord dashboard configuration", () => {
  test("validates server and application IDs before connecting", () => {
    expect(() => validateIdentity(settings)).not.toThrow();
    expect(() =>
      validateIdentity({ ...settings, discordApplicationId: "wrong" }),
    ).toThrow();
    expect(() =>
      validateIdentity({ ...settings, discordGuildId: null }),
    ).toThrow();
  });
  test("supports every dashboard activity and invisible status", () => {
    for (const [name, type] of Object.entries({
      playing: ActivityType.Playing,
      listening: ActivityType.Listening,
      watching: ActivityType.Watching,
      competing: ActivityType.Competing,
      custom: ActivityType.Custom,
    })) {
      expect(
        presence({
          ...settings,
          discordActivityType: name,
          discordStatus: "invisible",
        }),
      ).toMatchObject({
        status: "invisible",
        activities: [{ name: "the community", type }],
      });
    }
    expect(
      presence({ ...settings, discordActivityType: "custom" }).activities?.[0],
    ).toMatchObject({ state: "the community" });
  });
  test("allows clearing activity and rejects unsupported values", () => {
    expect(
      presence({ ...settings, discordActivityText: " " }).activities,
    ).toEqual([]);
    expect(() => presence({ ...settings, discordStatus: "bogus" })).toThrow();
    expect(() =>
      presence({ ...settings, discordActivityType: "bogus" }),
    ).toThrow();
    expect(() =>
      presence({ ...settings, discordActivityText: "x".repeat(129) }),
    ).toThrow();
  });
  test("streaming accepts only HTTPS Twitch and YouTube hosts", () => {
    for (const host of [
      "twitch.tv",
      "www.twitch.tv",
      "youtube.com",
      "www.youtube.com",
    ]) {
      expect(
        presence({
          ...settings,
          discordActivityType: "streaming",
          discordActivityUrl: `https://${host}/mrdemonwolf`,
        }).activities?.[0],
      ).toMatchObject({
        type: ActivityType.Streaming,
        url: `https://${host}/mrdemonwolf`,
      });
    }
    for (const url of [
      "",
      "http://twitch.tv/name",
      "https://twitch.tv.evil.example/name",
      "https://evil.example/name",
      "https://name:secret@twitch.tv/name",
      "https://twitch.tv:8443/name",
    ]) {
      expect(() =>
        presence({
          ...settings,
          discordActivityType: "streaming",
          discordActivityUrl: url,
        }),
      ).toThrow();
    }
  });
});
