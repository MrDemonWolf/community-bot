import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/twitch/vitest.config.ts",
  "apps/discord/vitest.config.ts",
  "apps/web/vitest.config.ts",
  "packages/events/vitest.config.ts",
  "packages/api/vitest.config.ts",
]);
