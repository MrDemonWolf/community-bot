import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";

/**
 * Background job: sync Twitch account links from Discord connections.
 *
 * For users who have logged in via the web dashboard and linked their
 * Discord account, checks their Discord connections for a Twitch account
 * and creates a linked Account entry if one doesn't already exist.
 *
 * Only works for users with a stored Discord OAuth token that includes
 * the `connections` scope.
 */
export default async function syncTwitchLinks(): Promise<void> {
  try {
    // Find all users with a Discord account that has an access token
    const discordAccounts = await prisma.account.findMany({
      where: {
        providerId: "discord",
        accessToken: { not: null },
      },
      select: {
        userId: true,
        accessToken: true,
      },
    });

    if (discordAccounts.length === 0) {
      logger.info("SyncTwitchLinks", "No Discord accounts to check");
      return;
    }

    let linked = 0;
    let skipped = 0;
    let errors = 0;

    for (const discordAccount of discordAccounts) {
      try {
        // Skip if user already has a Twitch account
        const existingTwitch = await prisma.account.findFirst({
          where: { userId: discordAccount.userId, providerId: "twitch" },
        });

        if (existingTwitch) {
          skipped++;
          continue;
        }

        // Fetch Discord connections
        const res = await fetch(
          "https://discord.com/api/v10/users/@me/connections",
          {
            headers: {
              Authorization: `Bearer ${discordAccount.accessToken}`,
            },
          }
        );

        if (!res.ok) {
          // Token may be expired or missing connections scope
          skipped++;
          continue;
        }

        const connections = (await res.json()) as Array<{
          type: string;
          id: string;
          name: string;
          verified: boolean;
        }>;

        const twitchConnection = connections.find(
          (c) => c.type === "twitch" && c.verified
        );

        if (!twitchConnection) {
          skipped++;
          continue;
        }

        // Create Twitch account link
        const id = crypto.randomUUID();
        await prisma.account.create({
          data: {
            id,
            userId: discordAccount.userId,
            providerId: "twitch",
            accountId: twitchConnection.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        linked++;
      } catch {
        errors++;
      }
    }

    logger.info(
      "SyncTwitchLinks",
      `Sync complete: ${linked} linked, ${skipped} skipped, ${errors} errors (${discordAccounts.length} checked)`
    );
  } catch (err) {
    logger.error("SyncTwitchLinks", "Error in syncTwitchLinks job", err);
  }
}
