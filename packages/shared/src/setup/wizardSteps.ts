import { z } from "zod";
import { DiscordSnowflakeSchema, NonEmptyStringSchema } from "../zod/common";

export const SetupStep = {
  WELCOME: 1,
  TWITCH_BROADCASTER: 2,
  TWITCH_BOT: 3,
  DISCORD_CONNECT: 4,
  DISCORD_GUILD: 5,
  ROLE_MAP: 6,
  STREAM_ALERTS: 7,
  BOT_MODE: 8,
  REVIEW: 9,
} as const;

export type SetupStepNumber = (typeof SetupStep)[keyof typeof SetupStep];

export const SETUP_STEP_ORDER: SetupStepNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const SETUP_STEP_LABELS: Record<SetupStepNumber, string> = {
  1: "Welcome",
  2: "Connect Twitch (broadcaster)",
  3: "Connect Twitch (bot account)",
  4: "Connect Discord",
  5: "Pick Discord server",
  6: "Map Discord roles",
  7: "Stream alerts",
  8: "Bot mode",
  9: "Review",
};

export const SETUP_STEP_AUDIT_ACTIONS: Record<SetupStepNumber, string> = {
  1: "setup.step1_welcome",
  2: "setup.step2_twitch_broadcaster",
  3: "setup.step3_twitch_bot",
  4: "setup.step4_discord_connect",
  5: "setup.step5_discord_guild",
  6: "setup.step6_role_map",
  7: "setup.step7_stream_alerts",
  8: "setup.step8_bot_mode",
  9: "setup.step9_review",
};

export const BotModeSchema = z.enum(["single_account", "separate_account"]);
export const AlertEmbedStyleSchema = z.enum(["rich", "plain"]);
export const MappableRoleSchema = z.enum(["mod", "vip", "sub", "viewer"]);
export type MappableRole = z.infer<typeof MappableRoleSchema>;

export const Step1WelcomeSchema = z.object({
  botDisplayName: NonEmptyStringSchema.max(64),
});

export const Step2TwitchBroadcasterSchema = z.object({
  acknowledged: z.literal(true),
});

export const Step3TwitchBotSchema = z.object({
  mode: z.enum(["same_account", "separate_account_connected"]),
});

export const Step4DiscordConnectSchema = z.object({
  acknowledged: z.literal(true),
});

export const Step5DiscordGuildSchema = z.object({
  guildId: DiscordSnowflakeSchema,
});

export const Step6RoleMapSchema = z.object({
  roleMap: z.record(DiscordSnowflakeSchema, MappableRoleSchema),
});

export const Step7StreamAlertsSchema = z.object({
  channelId: DiscordSnowflakeSchema,
  embedStyle: AlertEmbedStyleSchema,
  alertEveryone: z.boolean(),
});

export const Step8BotModeSchema = z.object({
  botMode: BotModeSchema,
});

export const Step9ReviewSchema = z.object({
  confirmed: z.literal(true),
});

export const SETUP_STEP_SCHEMAS = {
  1: Step1WelcomeSchema,
  2: Step2TwitchBroadcasterSchema,
  3: Step3TwitchBotSchema,
  4: Step4DiscordConnectSchema,
  5: Step5DiscordGuildSchema,
  6: Step6RoleMapSchema,
  7: Step7StreamAlertsSchema,
  8: Step8BotModeSchema,
  9: Step9ReviewSchema,
} as const;

export type SetupStepPayloads = {
  1: z.infer<typeof Step1WelcomeSchema>;
  2: z.infer<typeof Step2TwitchBroadcasterSchema>;
  3: z.infer<typeof Step3TwitchBotSchema>;
  4: z.infer<typeof Step4DiscordConnectSchema>;
  5: z.infer<typeof Step5DiscordGuildSchema>;
  6: z.infer<typeof Step6RoleMapSchema>;
  7: z.infer<typeof Step7StreamAlertsSchema>;
  8: z.infer<typeof Step8BotModeSchema>;
  9: z.infer<typeof Step9ReviewSchema>;
};
