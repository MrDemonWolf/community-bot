import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/community_bot_test";

export default defineConfig({
  test: {
    name: "api-integration",
    environment: "node",
    include: ["**/*.integration.test.ts"],
    fileParallelism: false,
    globalSetup: ["../db/src/integration-setup.ts"],
    testTimeout: 30_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
    },
  },
});
