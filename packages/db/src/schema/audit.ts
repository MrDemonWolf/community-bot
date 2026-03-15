import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./auth";

export const auditLogs = pgTable(
  "AuditLog",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    userName: text("userName").notNull(),
    userImage: text("userImage"),
    userRole: userRoleEnum("userRole").notNull(),
    action: text("action").notNull(),
    resourceType: text("resourceType").notNull(),
    resourceId: text("resourceId").notNull(),
    metadata: jsonb("metadata"),
    ipAddress: text("ipAddress"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    index("AuditLog_userId_idx").on(t.userId),
    index("AuditLog_resourceType_idx").on(t.resourceType),
    index("AuditLog_createdAt_idx").on(t.createdAt),
  ]
);
