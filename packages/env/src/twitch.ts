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
    INIT_TWITCH_ACCESS_TOKEN: z.string().min(1).optional(),
    INIT_TWITCH_REFRESH_TOKEN: z.string().min(1).optional(),
    TWITCH_CHANNEL: z.string().min(1, "Twitch channel is required"),
    HOST: z.string().default("localhost"),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("production"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
