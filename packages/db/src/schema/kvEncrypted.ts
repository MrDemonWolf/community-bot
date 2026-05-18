import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const kvEncrypted = pgTable("kv_encrypted", {
  key: text("key").primaryKey(),
  valueCiphertext: text("value_ciphertext").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
