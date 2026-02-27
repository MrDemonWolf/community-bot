import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default async function cleanupInactiveAccounts(): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - ONE_YEAR_MS);

    // Look up the broadcaster to exclude them from cleanup
    const broadcasterConfig = await prisma.systemConfig.findUnique({
      where: { key: "broadcasterUserId" },
    });
    const broadcasterUserId = broadcasterConfig?.value ?? "";

    // Find inactive users:
    // - Must be role USER (not ADMIN, MODERATOR, LEAD_MODERATOR)
    // - Must not be the broadcaster
    // - Must have no sessions with expiresAt in the last 365 days
    // - Must have been created more than 365 days ago
    const inactiveUsers = await prisma.user.findMany({
      where: {
        role: "USER",
        id: { not: broadcasterUserId },
        sessions: { none: { expiresAt: { gte: cutoffDate } } },
        createdAt: { lt: cutoffDate },
      },
      select: { id: true },
    });

    if (inactiveUsers.length === 0) {
      logger.info("Cleanup", "No inactive accounts to clean up");
      return;
    }

    await prisma.user.deleteMany({
      where: { id: { in: inactiveUsers.map((u) => u.id) } },
    });

    logger.info(
      "Cleanup",
      `Deleted ${inactiveUsers.length} inactive account(s)`
    );
  } catch (err) {
    logger.error("Cleanup", "Error in cleanupInactiveAccounts job", err);
  }
}
