import {
  pgTable,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const discordMessageTemplates = pgTable(
  "DiscordMessageTemplate",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    name: text("name").notNull(),
    content: text("content"),
    embedJson: text("embedJson"),
    createdBy: text("createdBy").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordMessageTemplate_guildId_name_key").on(t.guildId, t.name),
    index("DiscordMessageTemplate_guildId_idx").on(t.guildId),
  ]
);
