import { sql } from "drizzle-orm";
import { customType, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const inet = customType<{ data: string }>({
  dataType: () => "inet",
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payload: jsonb("payload"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("audit_actor_created_idx").on(t.actorUserId, t.createdAt),
    index("audit_target_idx").on(t.targetType, t.targetId),
  ],
);
