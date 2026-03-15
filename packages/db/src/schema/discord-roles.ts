import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const discordRolePanels = pgTable(
  "DiscordRolePanel",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    name: text("name").notNull(),
    channelId: text("channelId"),
    messageId: text("messageId"),
    title: text("title"),
    description: text("description"),
    useMenu: boolean("useMenu").notNull().default(false),
    createdBy: text("createdBy").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordRolePanel_guildId_name_key").on(t.guildId, t.name),
    index("DiscordRolePanel_guildId_idx").on(t.guildId),
  ]
);

export const discordRoleButtons = pgTable(
  "DiscordRoleButton",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    panelId: text("panelId").notNull(),
    roleId: text("roleId").notNull(),
    label: text("label").notNull(),
    emoji: text("emoji"),
    style: integer("style").notNull().default(1),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordRoleButton_panelId_roleId_key").on(t.panelId, t.roleId),
    index("DiscordRoleButton_panelId_idx").on(t.panelId),
  ]
);
