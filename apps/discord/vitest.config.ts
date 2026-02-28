import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "discord",
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
  },
});
