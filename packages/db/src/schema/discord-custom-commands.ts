import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const discordCustomCommands = pgTable(
  "DiscordCustomCommand",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default("A custom command"),
    response: text("response"),
    embedJson: text("embedJson"),
    ephemeral: boolean("ephemeral").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    allowedRoles: text("allowedRoles")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdBy: text("createdBy").notNull(),
    useCount: integer("useCount").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordCustomCommand_guildId_name_key").on(t.guildId, t.name),
    index("DiscordCustomCommand_guildId_idx").on(t.guildId),
  ]
);
