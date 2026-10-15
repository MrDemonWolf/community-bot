import { sql } from "drizzle-orm";
import { check, customType, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const personalProfile = pgTable("personal_profile", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("default"),
}, (t) => [check("personal_profile_source", sql`${t.source} IN ('default','twitch','discord','custom')`)]);

// Three bounded binary slots total at most 768 KiB per person, below the 1 MB budget.
export const personalAvatar = pgTable("personal_avatar", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  webp: bytea("webp").notNull(),
  version: text("version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.source] }),
  check("personal_avatar_source", sql`${t.source} IN ('twitch','discord','custom')`),
  check("personal_avatar_size", sql`octet_length(${t.webp}) BETWEEN 12 AND 262144`),
  check("personal_avatar_webp", sql`substring(${t.webp} from 1 for 4) = decode('52494646','hex') AND substring(${t.webp} from 9 for 4) = decode('57454250','hex')`),
  check("personal_avatar_version", sql`${t.version} ~ '^[0-9a-f-]{36}$'`),
]);
