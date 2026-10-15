import { expect, test } from "bun:test";
import { coreInput, discordInput, presenceInput, twitchInput } from "./validation";
import { inputErrorMessage } from "./input-errors";

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

test("common settings failures explain how to fix the field", () => {
  const core = { botName: "WolfAide", commandPrefix: "!", publicPageEnabled: false, publicDescription: "" };
  const cases = [
    [coreInput.safeParse({ ...core, commandPrefix: "! bad" }), "Command prefix: Use 1–5 characters with no spaces."],
    [coreInput.safeParse({ ...core, botName: " " }), "Bot display name: Enter a display name."],
    [coreInput.safeParse({ ...core, publicDescription: "a".repeat(281) }), "Public channel description: Use 280 characters or fewer."],
    [discordInput.safeParse({ applicationId: "bad", guildId: "123456789012345678" }), "Discord application ID: Enter the 17–20 digit application ID from the Discord developer portal."],
    [discordInput.safeParse({ applicationId: "123456789012345678", guildId: "bad" }), "Discord server ID: Enter a 17–20 digit server ID. Enable Discord Developer Mode to copy it."],
    [discordInput.safeParse({ applicationId: "123456789012345678", guildId: "123456789012345678", token: "Bot " + "a".repeat(40) }), "Discord bot token: Paste only the raw bot token, without the Bot prefix."],
    [twitchInput.safeParse({ clientId: "wrong" }), "Twitch client ID: Copy the 10–100 letter and number client ID from your Twitch developer application."],
  ] as const;
  for (const [result, message] of cases) {
    expect(result.success).toBe(false);
    if (!result.success) expect(inputErrorMessage(result.error)).toBe(message);
  }
});
