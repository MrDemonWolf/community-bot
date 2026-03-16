import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const discordScheduleTypeEnum = pgEnum("DiscordScheduleType", [
  "ONCE",
  "RECURRING",
]);

export const discordScheduledMessages = pgTable(
  "DiscordScheduledMessage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    channelId: text("channelId").notNull(),
    name: text("name").notNull(),
    type: discordScheduleTypeEnum("type").notNull(),
    cronExpression: text("cronExpression"),
    scheduledAt: timestamp("scheduledAt"),
    templateId: text("templateId"),
    content: text("content"),
    embedJson: text("embedJson"),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt"),
    bullMqJobId: text("bullMqJobId"),
    repeatJobKey: text("repeatJobKey"),
    createdBy: text("createdBy").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordScheduledMessage_guildId_name_key").on(t.guildId, t.name),
    index("DiscordScheduledMessage_guildId_idx").on(t.guildId),
    index("DiscordScheduledMessage_enabled_idx").on(t.enabled),
  ]
);
