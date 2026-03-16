import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const systemConfigs = pgTable("SystemConfig", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});
