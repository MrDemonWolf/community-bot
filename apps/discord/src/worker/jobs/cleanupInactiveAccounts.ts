import { db, eq, ne, lt, gte, and, notInArray, inArray, sql, users, sessions, systemConfigs } from "@community-bot/db";
import logger from "../../utils/logger.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default async function cleanupInactiveAccounts(): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - ONE_YEAR_MS);

    // Look up the broadcaster to exclude them from cleanup
    const broadcasterConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, "broadcasterUserId"),
    });
    const broadcasterUserId = broadcasterConfig?.value ?? "";

    // Find users with recent sessions (to exclude them)
    const usersWithRecentSessions = db.select({ userId: sessions.userId }).from(sessions).where(gte(sessions.expiresAt, cutoffDate));

    // Find inactive users:
    // - Must be role USER (not BROADCASTER, MODERATOR, LEAD_MODERATOR)
    // - Must not be the broadcaster
    // - Must have no sessions with expiresAt in the last 365 days
    // - Must have been created more than 365 days ago
    const inactiveUsers = await db.select({ id: users.id }).from(users).where(
      and(
        eq(users.role, "USER"),
        ne(users.id, broadcasterUserId),
        lt(users.createdAt, cutoffDate),
        notInArray(users.id, usersWithRecentSessions)
      )
    );

    if (inactiveUsers.length === 0) {
      logger.info("Cleanup", "No inactive accounts to clean up");
      return;
    }

    await db.delete(users).where(inArray(users.id, inactiveUsers.map((u) => u.id)));

    logger.info(
      "Cleanup",
      `Deleted ${inactiveUsers.length} inactive account(s)`
    );
  } catch (err) {
    logger.error("Cleanup", "Error in cleanupInactiveAccounts job", err);
  }
}
