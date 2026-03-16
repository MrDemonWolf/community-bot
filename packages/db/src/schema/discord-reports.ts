import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const discordReportStatusEnum = pgEnum("DiscordReportStatus", [
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "DISMISSED",
]);

export const discordReports = pgTable(
  "DiscordReport",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text("guildId").notNull(),
    reporterId: text("reporterId").notNull(),
    reporterTag: text("reporterTag").notNull(),
    targetId: text("targetId").notNull(),
    targetTag: text("targetTag").notNull(),
    reason: text("reason").notNull(),
    status: discordReportStatusEnum("status").notNull().default("OPEN"),
    resolvedBy: text("resolvedBy"),
    resolvedAt: timestamp("resolvedAt"),
    resolution: text("resolution"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("DiscordReport_guildId_idx").on(t.guildId),
    index("DiscordReport_status_idx").on(t.status),
    index("DiscordReport_targetId_idx").on(t.targetId),
  ]
);
