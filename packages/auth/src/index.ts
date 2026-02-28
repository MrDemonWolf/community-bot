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

/**
 * After a Discord login, check the user's Discord connections for a
 * linked Twitch account. If found and the user doesn't already have a
 * Twitch account entry, create one automatically.
 */
async function autoLinkTwitchFromDiscord(userId: string) {
	try {
		const discordAccount = await prisma.account.findFirst({
			where: { userId, providerId: "discord" },
		});

		if (!discordAccount?.accessToken) return;

		// Check if user already has a Twitch account linked
		const existingTwitch = await prisma.account.findFirst({
			where: { userId, providerId: "twitch" },
		});

		if (existingTwitch) return;

		// Fetch Discord connections using the user's OAuth token
		const res = await fetch("https://discord.com/api/v10/users/@me/connections", {
			headers: { Authorization: `Bearer ${discordAccount.accessToken}` },
		});

		if (!res.ok) return;

		const connections = (await res.json()) as Array<{
			type: string;
			id: string;
			name: string;
			verified: boolean;
		}>;

		const twitchConnection = connections.find(
			(c) => c.type === "twitch" && c.verified
		);

		if (!twitchConnection) return;

		// Create a Twitch account entry linked to this user
		const id = crypto.randomUUID();
		await prisma.account.create({
			data: {
				id,
				userId,
				providerId: "twitch",
				accountId: twitchConnection.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
	} catch {
		// Silently fail — auto-linking is best-effort
	}
}

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	trustedOrigins: [env.CORS_ORIGIN],
	socialProviders: {
		discord: {
			clientId: env.DISCORD_APPLICATION_ID,
			clientSecret: env.DISCORD_APPLICATION_CLIENT_SECRET,
			scope: ["identify", "email", "connections"],
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
	databaseHooks: {
		session: {
			create: {
				after: async (session) => {
					// After a session is created (login), try to auto-link Twitch from Discord
					autoLinkTwitchFromDiscord(session.userId);
				},
			},
		},
	},
	plugins: [
		// nextCookies() enables cookie-based sessions in Next.js server components.
		nextCookies(),
		// Track which provider the user last signed in with.
		lastLoginMethod({ storeInDatabase: true }),
	],
});
