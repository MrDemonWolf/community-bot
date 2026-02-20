/**
 * @community-bot/db — Shared Prisma client and type re-exports.
 *
 * Uses the PrismaPg driver adapter for native PostgreSQL connections
 * (instead of Prisma's default query engine binary). All apps import
 * the `prisma` client and model types from this package.
 */
import "dotenv/config";
import { PrismaClient } from "../prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
export const prisma = new PrismaClient({ adapter });

export default prisma;

// Re-export generated types so consumers can import models and enums
// directly from @community-bot/db instead of reaching into generated paths.
export * from "../prisma/generated/client";
export * from "../prisma/generated/enums";
export * from "../prisma/generated/models";
