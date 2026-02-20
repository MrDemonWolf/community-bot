/**
 * @community-bot/auth — Shared authentication configuration.
 *
 * Uses better-auth with Prisma adapter for session management and
 * Discord/Twitch OAuth social login. Consumed by the web dashboard.
 */
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
		// Allow users to link both Discord and Twitch to a single account.
		// Both providers are "trusted" so linking happens automatically
		// without requiring email verification.
		accountLinking: {
			enabled: true,
			trustedProviders: ["discord", "twitch"],
		},
	},
	plugins: [
		// nextCookies() enables cookie-based sessions in Next.js server components.
		nextCookies(),
		// Track which provider the user last signed in with.
		lastLoginMethod({ storeInDatabase: true }),
	],
});
