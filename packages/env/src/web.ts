import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_PRIVACY_POLICY_URL: z.string().url().optional(),
		NEXT_PUBLIC_TERMS_OF_SERVICE_URL: z.string().url().optional(),
		NEXT_PUBLIC_SINGLE_CHANNEL_MODE: z
			.enum(["true", "false"])
			.default("false")
			.transform((v) => v === "true"),
		NEXT_PUBLIC_CHANNEL_URL: z.string().url().optional(),
		NEXT_PUBLIC_CHANNEL_NAME: z.string().optional(),
		NEXT_PUBLIC_LOGO_URL: z.string().url().optional(),
		NEXT_PUBLIC_LOGO_DARK_URL: z.string().url().optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_PRIVACY_POLICY_URL: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL,
		NEXT_PUBLIC_TERMS_OF_SERVICE_URL: process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL,
		NEXT_PUBLIC_SINGLE_CHANNEL_MODE: process.env.NEXT_PUBLIC_SINGLE_CHANNEL_MODE,
		NEXT_PUBLIC_CHANNEL_URL: process.env.NEXT_PUBLIC_CHANNEL_URL,
		NEXT_PUBLIC_CHANNEL_NAME: process.env.NEXT_PUBLIC_CHANNEL_NAME,
		NEXT_PUBLIC_LOGO_URL: process.env.NEXT_PUBLIC_LOGO_URL,
		NEXT_PUBLIC_LOGO_DARK_URL: process.env.NEXT_PUBLIC_LOGO_DARK_URL,
	},
	emptyStringAsUndefined: true,
});
