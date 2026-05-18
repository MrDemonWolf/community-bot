import { relations, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

const ALLOWED_ROLES = ["guest", "viewer", "sub", "vip", "mod", "broadcaster"] as const;

export const userMeta = pgTable(
  "user_meta",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    twitchUserId: text("twitch_user_id"),
    discordUserId: text("discord_user_id"),
    role: text("role").notNull().default("viewer"),
    linkedAt: timestamp("linked_at"),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_meta_twitch_idx").on(t.twitchUserId),
    uniqueIndex("user_meta_discord_idx").on(t.discordUserId),
    index("user_meta_role_idx").on(t.role),
    check(
      "user_meta_role_check",
      sql`${t.role} IN (${sql.join(
        ALLOWED_ROLES.map((r) => sql`${r}`),
        sql`, `,
      )})`,
    ),
  ],
);

export const userMetaRelations = relations(userMeta, ({ one }) => ({
  user: one(user, { fields: [userMeta.userId], references: [user.id] }),
}));
