/**
 * Audit log utility.
 *
 * Every mutation in the web dashboard calls `logAudit()` to record who
 * did what. The user's current role is looked up at write time so the
 * dashboard can filter the feed by role hierarchy (USER < MODERATOR <
 * LEAD_MODERATOR < BROADCASTER). Metadata captures action-specific details
 * like old/new values or resource names.
 */
import { prisma } from "@community-bot/db";

export interface AuditLogInput {
  userId: string;
  userName: string;
  userImage?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Record a mutation to the audit log, looking up the user's current role. */
export async function logAudit(input: AuditLogInput): Promise<void> {
  // Fetch the user's role at write time so the dashboard can filter by
  // role hierarchy without needing a join at read time.
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { role: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      userName: input.userName,
      userImage: input.userImage ?? undefined,
      userRole: user?.role ?? "USER",
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: (input.metadata ?? undefined) as
        | Record<string, string | number | boolean | null>
        | undefined,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}
