import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const discordCaseTypeEnum = pgEnum("DiscordCaseType", [
  "BAN",
  "TEMPBAN",
  "KICK",
  "WARN",
  "MUTE",
  "UNBAN",
  "UNWARN",
  "UNMUTE",
  "NOTE",
]);

export const discordCases = pgTable(
  "DiscordCase",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    caseNumber: integer("caseNumber").notNull(),
    type: discordCaseTypeEnum("type").notNull(),
    targetId: text("targetId").notNull(),
    targetTag: text("targetTag").notNull(),
    moderatorId: text("moderatorId").notNull(),
    moderatorTag: text("moderatorTag").notNull(),
    reason: text("reason"),
    duration: integer("duration"),
    expiresAt: timestamp("expiresAt"),
    resolved: boolean("resolved").notNull().default(false),
    resolvedBy: text("resolvedBy"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordCase_guildId_caseNumber_key").on(t.guildId, t.caseNumber),
    index("DiscordCase_guildId_idx").on(t.guildId),
    index("DiscordCase_targetId_idx").on(t.targetId),
    index("DiscordCase_moderatorId_idx").on(t.moderatorId),
  ]
);

export const discordCaseNotes = pgTable(
  "DiscordCaseNote",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    caseId: text("caseId").notNull(),
    authorId: text("authorId").notNull(),
    authorTag: text("authorTag").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [index("DiscordCaseNote_caseId_idx").on(t.caseId)]
);

export const discordWarnThresholds = pgTable(
  "DiscordWarnThreshold",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    count: integer("count").notNull(),
    action: discordCaseTypeEnum("action").notNull(),
    duration: integer("duration"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("DiscordWarnThreshold_guildId_count_key").on(t.guildId, t.count),
    index("DiscordWarnThreshold_guildId_idx").on(t.guildId),
  ]
);
