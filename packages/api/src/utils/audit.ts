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

export async function logAudit(input: AuditLogInput): Promise<void> {
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
