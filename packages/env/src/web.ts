/** Web dashboard client-side environment config (NEXT_PUBLIC_* vars). */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_PRIVACY_POLICY_URL: z.string().url().optional(),
		NEXT_PUBLIC_TERMS_OF_SERVICE_URL: z.string().url().optional(),
		NEXT_PUBLIC_COPYRIGHT_NAME: z.string().optional(),
		NEXT_PUBLIC_COPYRIGHT_URL: z.string().url().optional(),
		NEXT_PUBLIC_SOCIAL_LINKS: z.string().optional(),
		NEXT_PUBLIC_COMPANY_NAME: z.string().optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_PRIVACY_POLICY_URL: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL,
		NEXT_PUBLIC_TERMS_OF_SERVICE_URL: process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL,
		NEXT_PUBLIC_COPYRIGHT_NAME: process.env.NEXT_PUBLIC_COPYRIGHT_NAME,
		NEXT_PUBLIC_COPYRIGHT_URL: process.env.NEXT_PUBLIC_COPYRIGHT_URL,
		NEXT_PUBLIC_SOCIAL_LINKS: process.env.NEXT_PUBLIC_SOCIAL_LINKS,
		NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
	},
	emptyStringAsUndefined: true,
});
