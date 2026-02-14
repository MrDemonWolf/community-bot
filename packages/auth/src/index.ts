import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "@community-bot/env/server";
import prisma from "@community-bot/db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
provider: "postgresql",



	}),

	trustedOrigins: [
		env.CORS_ORIGIN,
	],
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
        nextCookies()
    ],
});



