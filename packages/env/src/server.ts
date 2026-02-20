import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		DISCORD_APPLICATION_ID: z.string().min(1),
		DISCORD_APPLICATION_CLIENT_SECRET: z.string().min(1),
		DISCORD_BOT_TOKEN: z.string().min(1),
		TWITCH_APPLICATION_CLIENT_ID: z.string().min(1),
		TWITCH_APPLICATION_CLIENT_SECRET: z.string().min(1),
		REDIS_URL: z
			.string()
			.min(1)
			.refine(
				(url) => url.startsWith("redis"),
				"Invalid Redis URL"
			),
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
