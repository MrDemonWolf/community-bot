import { pgTable, pgEnum, text, integer, timestamp } from "drizzle-orm/pg-core";

export const queueStatusEnum = pgEnum("QueueStatus", [
  "OPEN",
  "CLOSED",
  "PAUSED",
]);

export const queueEntries = pgTable("QueueEntry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  twitchUserId: text("twitchUserId").notNull().unique(),
  twitchUsername: text("twitchUsername").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const queueStates = pgTable("QueueState", {
  id: text("id").primaryKey().default("singleton"),
  status: queueStatusEnum("status").notNull().default("CLOSED"),
});
