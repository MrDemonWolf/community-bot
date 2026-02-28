/**
 * Global setup for integration tests.
 * Runs `prisma migrate deploy` against the test database before tests start.
 */
import { execSync } from "node:child_process";
import path from "node:path";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/community_bot_test";

export async function setup() {
  const schemaDir = path.resolve(
    import.meta.dirname,
    "..",
    "prisma",
    "schema"
  );

  console.log("[integration-setup] Running prisma migrate deploy…");
  execSync(`npx prisma migrate deploy --schema="${schemaDir}"`, {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
    cwd: path.resolve(import.meta.dirname, ".."),
  });
  console.log("[integration-setup] Migrations applied.");
}
