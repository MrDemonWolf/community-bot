import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "twitch",
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
  },
});
