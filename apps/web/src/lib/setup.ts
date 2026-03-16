/**
 * First-time setup utilities.
 *
 * On first startup the web dashboard generates a one-time setup token and
 * logs a URL. The first user to visit that URL completes the setup wizard,
 * becomes the broadcaster, and is promoted to BROADCASTER. Runtime config is
 * stored in the SystemConfig table as key-value pairs.
 */
import { db, eq, systemConfigs } from "@community-bot/db";
import { randomBytes } from "crypto";

/**
 * Generate and persist a setup token if first-time setup hasn't been
 * completed yet. Logs the setup URL to the console. Called once on
 * startup from the Next.js instrumentation hook.
 */
export async function ensureSetupToken() {
  const setupComplete = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "setupComplete"),
  });
  if (setupComplete?.value === "true") return;

  // Check if token already exists; create one if not
  const existing = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "setupToken"),
  });

  const token = existing
    ? existing.value
    : randomBytes(32).toString("hex");

  if (!existing) {
    await db
      .insert(systemConfigs)
      .values({ key: "setupToken", value: token })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: token },
      });
  }

  const url = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3001"}/setup/${token}`;
  console.log("");
  console.log("SETUP REQUIRED - Open this URL to complete first-time setup:");
  console.log("");
  console.log(url);
  console.log("");
}

/** Return the broadcaster's User ID, or null if setup hasn't completed. */
export async function getBroadcasterUserId(): Promise<string | null> {
  const config = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "broadcasterUserId"),
  });
  return config?.value ?? null;
}

/** Check whether the first-time setup wizard has been completed. */
export async function isSetupComplete(): Promise<boolean> {
  const config = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "setupComplete"),
  });
  return config?.value === "true";
}
