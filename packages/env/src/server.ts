import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    APP_ENCRYPTION_KEY: z
      .string()
      .refine(
        (s) => /^[A-Za-z0-9+/]{43}=$/.test(s),
        "Use a base64-encoded 32-byte key",
      ),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    OWNER_EMAIL: z.email().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DEV_LOGIN: z.enum(["true", "false"]).default("false"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
