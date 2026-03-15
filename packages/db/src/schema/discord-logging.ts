import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const discordLogConfigs = pgTable("DiscordLogConfig", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  guildId: text("guildId").notNull().unique(),
  moderationChannelId: text("moderationChannelId"),
  serverChannelId: text("serverChannelId"),
  voiceChannelId: text("voiceChannelId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});
