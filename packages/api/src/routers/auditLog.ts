import { db, eq, and, desc, count, inArray, like, auditLogs, botChannels, users } from "@community-bot/db";
import { protectedProcedure, router } from "../index";
import { z } from "zod";

const ROLE_HIERARCHY: Record<string, number> = {
  USER: 0,
  MODERATOR: 1,
  LEAD_MODERATOR: 2,
  BROADCASTER: 3,
};

export const auditLogRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(25),
          action: z.string().optional(),
          resourceType: z.string().optional(),
        })
        .default({ skip: 0, take: 25 })
    )
    .query(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, ctx.session.user.id) });

      const currentRole = user?.role ?? "USER";
      const currentLevel = ROLE_HIERARCHY[currentRole] ?? 0;

      // Build role filter: users see logs from their level and below
      const visibleRoles = Object.entries(ROLE_HIERARCHY)
        .filter(([, level]) => level <= currentLevel)
        .map(([role]) => role);

      const conditions = [];

      // BROADCASTER sees all, others see only logs from their level and below
      if (currentRole !== "BROADCASTER") {
        conditions.push(inArray(auditLogs.userRole, visibleRoles as ("BROADCASTER" | "USER" | "MODERATOR" | "LEAD_MODERATOR")[]));

      }

      if (input.action) {
        conditions.push(like(auditLogs.action, `${input.action}%`));
      }

      if (input.resourceType) {
        conditions.push(eq(auditLogs.resourceType, input.resourceType));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalResult] = await Promise.all([
        db.query.auditLogs.findMany({
          where: whereClause,
          orderBy: desc(auditLogs.createdAt),
          offset: input.skip,
          limit: input.take,
        }),
        db.select({ value: count() }).from(auditLogs).where(whereClause),
      ]);

      const total = totalResult[0]?.value ?? 0;

      // Check which users are channel owners
      const userIds = [...new Set(items.map((item) => item.userId))];
      const channelOwners = userIds.length > 0
        ? await db.select({ userId: botChannels.userId }).from(botChannels).where(inArray(botChannels.userId, userIds))
        : [];
      const ownerSet = new Set(channelOwners.map((c) => c.userId));

      return {
        items: items.map((item) => ({
          id: item.id,
          userId: item.userId,
          userName: item.userName,
          userImage: item.userImage,
          userRole: item.userRole,
          isChannelOwner: ownerSet.has(item.userId),
          action: item.action,
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          metadata: item.metadata as Record<string, unknown> | null,
          createdAt: item.createdAt.toISOString(),
        })),
        total,
      };
    }),
});
