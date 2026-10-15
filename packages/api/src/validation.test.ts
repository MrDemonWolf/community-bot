import { expect, test } from "bun:test";
import { coreInput, discordInput, presenceInput } from "./validation";

test("dashboard trust boundaries reject invalid IDs, prefixes and streaming URLs", () => {
  const core = {
    botName: "WolfAide",
    commandPrefix: "!",
    publicPageEnabled: false,
    publicDescription: "Hello",
  };
  expect(coreInput.safeParse(core).success).toBe(true);
  expect(coreInput.safeParse({ ...core, commandPrefix: " " }).success).toBe(
    false,
  );
  expect(
    discordInput.safeParse({ applicationId: "wrong", guildId: "1" }).success,
  ).toBe(false);
  const p = {
    status: "online",
    activityType: "streaming",
    activityText: "Live",
  };
  expect(
    presenceInput.safeParse({
      ...p,
      activityUrl: "https://twitch.tv/mrdemonwolf",
    }).success,
  ).toBe(true);
  for (const url of [
    "javascript:alert(1)",
    "http://twitch.tv/mrdemonwolf",
    "https://twitch.tv.attacker.com",
    "https://me:secret@twitch.tv/",
  ]) {
    expect(presenceInput.safeParse({ ...p, activityUrl: url }).success).toBe(
      false,
    );
  }
  expect(presenceInput.safeParse(p).success).toBe(false);
});
