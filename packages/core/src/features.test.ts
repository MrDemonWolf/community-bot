import { describe, expect, test } from "bun:test";
import { featureEnabled, featureConfig, twitchCreatorScopes } from "./features";
import { executeCommand } from "./commands";

describe("shared features", () => {
  test("platform switches cannot disable the other platform", () => {
    const states = [{ featureId: "twitch.uptime", enabled: false, config: { cooldownSeconds: 7 } }];
    expect(featureEnabled("uptime", states, "twitch")).toBe(false);
    expect(featureEnabled("uptime", states, "discord")).toBe(true);
    expect(featureEnabled("presence", [], "twitch")).toBe(false);
    expect(featureConfig("uptime", states, "twitch")).toEqual({ cooldownSeconds: 7 });
  });
  test("creator scopes follow enabled features", () => {
    expect(twitchCreatorScopes({ channelPointsEnabled: false, permissionSyncTwitch: false })).toEqual([]);
    expect(twitchCreatorScopes({ channelPointsEnabled: true, permissionSyncTwitch: false })).toEqual(["channel:manage:redemptions"]);
  });
  test("both adapters share the same public command behavior", async () => {
    for (const platform of ["twitch", "discord"] as const) {
      const context = { platform, subject: { owner: false, grants: [] }, prefix: "!", botUptime: 65, hostUptime: 120, streamStartedAt: async () => null };
      expect(await executeCommand("uptime", context)).toBe("Bot uptime: 1m 5s.");
      expect(await executeCommand("streamuptime", context)).toBe("The channel is offline.");
    }
  });
});
