import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),

    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),

    TWITCH_CLIENT_ID: z.string().min(1).optional(),
    TWITCH_CLIENT_SECRET: z.string().min(1).optional(),

    ENCRYPTION_KEYS: z.string().min(1).optional(),
    ENCRYPTION_KEY_VERSION: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((v, ctx) => {
      if (!!v.ENCRYPTION_KEYS !== !!v.ENCRYPTION_KEY_VERSION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ENCRYPTION_KEYS and ENCRYPTION_KEY_VERSION must be set together",
          path: ["ENCRYPTION_KEYS"],
        });
      }
      if (!!v.TWITCH_CLIENT_ID !== !!v.TWITCH_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set together",
          path: ["TWITCH_CLIENT_ID"],
        });
      }
    }),
});
