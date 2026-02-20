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
    TWITCH_APPLICATION_CLIENT_ID: z
      .string()
      .min(1, "Twitch Client ID is required"),
    TWITCH_APPLICATION_CLIENT_SECRET: z
      .string()
      .min(1, "Twitch Client Secret is required"),
    REDIS_URL: z
      .string()
      .min(1, "Redis URL is required")
      .refine(
        (url) => url.startsWith("redis"),
        "Invalid Redis URL"
      ),
    APPLE_WEATHERKIT_KEY_ID: z.string().optional(),
    APPLE_WEATHERKIT_TEAM_ID: z.string().optional(),
    APPLE_WEATHERKIT_SERVICE_ID: z.string().optional(),
    APPLE_WEATHERKIT_PRIVATE_KEY: z.string().optional(),
    WEB_URL: z.string().url().optional(),
    HOST: z.string().default("localhost"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3737),
    CORS_ORIGIN: z.string().default("*"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("production"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
