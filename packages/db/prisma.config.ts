import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// Load env from multiple possible locations
dotenv.config({ path: "../../.env" });
dotenv.config({ path: "../../apps/web/.env" });
dotenv.config({ path: "../../apps/discord/.env" });
dotenv.config({ path: "../../apps/twitch/.env" });

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/community-bot",
  },
});
