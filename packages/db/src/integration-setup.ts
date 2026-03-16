/**
 * Global setup for integration tests.
 * Runs `drizzle-kit push` against the test database before tests start.
 */
import { execSync } from "node:child_process";
import path from "node:path";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/community_bot_test";

export async function setup() {
  console.log("[integration-setup] Running drizzle-kit push…");
  execSync(`npx drizzle-kit push`, {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
    cwd: path.resolve(import.meta.dirname, ".."),
  });
  console.log("[integration-setup] Schema pushed.");
}
