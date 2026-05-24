import { describe, expect, test } from "bun:test";
import {
  SETUP_STEP_ORDER,
  SETUP_STEP_SCHEMAS,
  Step1WelcomeSchema,
  Step5DiscordGuildSchema,
  Step6RoleMapSchema,
  Step7StreamAlertsSchema,
  Step8BotModeSchema,
} from "./wizardSteps";

describe("setup wizard schemas", () => {
  test("step order covers 1..9 exactly once", () => {
    expect(SETUP_STEP_ORDER).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Object.keys(SETUP_STEP_SCHEMAS)).toHaveLength(9);
  });

  test("step1 requires non-empty botDisplayName", () => {
    expect(Step1WelcomeSchema.safeParse({ botDisplayName: "" }).success).toBe(false);
    expect(Step1WelcomeSchema.safeParse({ botDisplayName: "HowlBot" }).success).toBe(true);
    expect(Step1WelcomeSchema.safeParse({ botDisplayName: "x".repeat(65) }).success).toBe(false);
  });

  test("step5 requires Discord snowflake", () => {
    expect(Step5DiscordGuildSchema.safeParse({ guildId: "abc" }).success).toBe(false);
    expect(Step5DiscordGuildSchema.safeParse({ guildId: "12345678901234567" }).success).toBe(true);
  });

  test("step6 rejects unknown community-bot roles", () => {
    expect(
      Step6RoleMapSchema.safeParse({ roleMap: { "12345678901234567": "editor" } }).success,
    ).toBe(false);
    expect(Step6RoleMapSchema.safeParse({ roleMap: { "12345678901234567": "mod" } }).success).toBe(
      true,
    );
  });

  test("step7 requires all three fields", () => {
    const ok = Step7StreamAlertsSchema.safeParse({
      channelId: "12345678901234567",
      embedStyle: "rich",
      alertEveryone: false,
    });
    expect(ok.success).toBe(true);
    expect(
      Step7StreamAlertsSchema.safeParse({ channelId: "x", embedStyle: "rich", alertEveryone: true })
        .success,
    ).toBe(false);
  });

  test("step8 only accepts known bot modes", () => {
    expect(Step8BotModeSchema.safeParse({ botMode: "single_account" }).success).toBe(true);
    expect(Step8BotModeSchema.safeParse({ botMode: "weird" }).success).toBe(false);
  });
});
