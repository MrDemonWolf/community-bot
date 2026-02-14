import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z
      .string()
      .min(1, "Database URL is required")
      .refine(
        (url) => url.startsWith("postgres"),
        "Invalid PostgreSQL database URL"
      ),
    REDIS_URL: z
      .string()
      .min(1, "Redis URL is required")
      .refine(
        (url) => url.startsWith("redis"),
        "Invalid Redis URL"
      ),
    DISCORD_APPLICATION_ID: z
      .string()
      .min(1, "Discord application ID is required"),
    DISCORD_APPLICATION_PUBLIC_KEY: z
      .string()
      .min(1, "Discord application public key is required"),
    DISCORD_APPLICATION_BOT_TOKEN: z
      .string()
      .min(1, "Discord application bot token is required"),
    DISCORD_DEFAULT_STATUS: z.string().default("over the Wolf Lair"),
    DISCORD_DEFAULT_ACTIVITY_TYPE: z
      .enum(["Playing", "Streaming", "Listening", "Custom"])
      .default("Custom"),
    DEFAULT_ACTIVITY_URL: z.string().optional(),
    DISCORD_ACTIVITY_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(1440)
      .default(15),
    OWNER_ID: z.string().min(1, "Owner ID is required"),
    MAIN_GUILD_ID: z.string().min(1, "Main guild ID is required"),
    MAIN_CHANNEL_ID: z.string().min(1, "Main channel ID is required"),
    TWITCH_CLIENT_ID: z.string().min(1, "Twitch client ID is required"),
    HOST: z.string().default("localhost"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3141),
    CORS_ORIGIN: z.string().default("*"),
    VERSION: z.string().default("1.0.0"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("production"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
