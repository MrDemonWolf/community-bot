import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { lastLoginMethod } from "better-auth/plugins";
import { env } from "@community-bot/env/server";
import prisma from "@community-bot/db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	trustedOrigins: [env.CORS_ORIGIN],
	socialProviders: {
		discord: {
			clientId: env.DISCORD_APPLICATION_ID,
			clientSecret: env.DISCORD_APPLICATION_CLIENT_SECRET,
		},
		twitch: {
			clientId: env.TWITCH_APPLICATION_CLIENT_ID,
			clientSecret: env.TWITCH_APPLICATION_CLIENT_SECRET,
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["discord", "twitch"],
		},
	},
	plugins: [
		nextCookies(),
		lastLoginMethod({ storeInDatabase: true }),
	],
});
