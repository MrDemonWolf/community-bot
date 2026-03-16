import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const discordGuilds = pgTable(
  "DiscordGuild",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull().unique(),
    name: text("name"),
    icon: text("icon"),
    userId: text("userId"),
    enabled: boolean("enabled").notNull().default(true),
    muted: boolean("muted").notNull().default(false),
    notificationChannelId: text("notificationChannelId"),
    notificationRoleId: text("notificationRoleId"),
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
    adminRoleId: text("adminRoleId"),
    modRoleId: text("modRoleId"),
  },
  (t) => [index("DiscordGuild_userId_idx").on(t.userId)]
);
