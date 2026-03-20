/**
 * One-time migration: convert intervalMinutes → onlineIntervalSeconds
 *
 * Run with: bun scripts/migrate-timers.ts
 *
 * Sets onlineIntervalSeconds = intervalMinutes * 60 for all timers where
 * onlineIntervalSeconds is still at the default value (300) and intervalMinutes
 * differs from 5 (the old default). Safe to run multiple times.
 */
import { db } from "../packages/db/src/index";
import { twitchTimers } from "../packages/db/src/schema/twitch";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating timers: intervalMinutes → onlineIntervalSeconds...");

  // Update all timers: onlineIntervalSeconds = intervalMinutes * 60
  // Only update rows where onlineIntervalSeconds is still the default (300)
  // and intervalMinutes * 60 != 300 (i.e. intervalMinutes != 5)
  const result = await db.execute(
    sql`UPDATE "TwitchTimer"
        SET "onlineIntervalSeconds" = "intervalMinutes" * 60
        WHERE "onlineIntervalSeconds" = 300
          AND "intervalMinutes" * 60 != 300`
  );

  const rowCount = result && typeof result === "object" && "rowCount" in result
    ? (result as { rowCount: number }).rowCount
    : "unknown";
  console.log(`Migration complete. Rows updated: ${rowCount}`);
  console.log(
    "intervalMinutes column is retained for backwards compatibility. " +
    "New code uses onlineIntervalSeconds / offlineIntervalSeconds."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
