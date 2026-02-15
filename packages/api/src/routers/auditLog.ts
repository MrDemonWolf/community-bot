import { prisma } from "@community-bot/db";
import { protectedProcedure, router } from "../index";
import { z } from "zod";

const ROLE_HIERARCHY: Record<string, number> = {
  USER: 0,
  MODERATOR: 1,
  LEAD_MODERATOR: 2,
  ADMIN: 3,
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
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { role: true },
      });

      const currentRole = user?.role ?? "USER";
      const currentLevel = ROLE_HIERARCHY[currentRole] ?? 0;

      // Build role filter: users see logs from their level and below
      const visibleRoles = Object.entries(ROLE_HIERARCHY)
        .filter(([, level]) => level <= currentLevel)
        .map(([role]) => role);

      const where: Record<string, unknown> = {};

      // ADMIN sees all, others see only logs from their level and below
      if (currentRole !== "ADMIN") {
        where.userRole = { in: visibleRoles };
      }

      if (input.action) {
        where.action = { startsWith: input.action };
      }

      if (input.resourceType) {
        where.resourceType = input.resourceType;
      }

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: input.skip,
          take: input.take,
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Check which users are channel owners
      const userIds = [...new Set(items.map((item) => item.userId))];
      const channelOwners = await prisma.botChannel.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true },
      });
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
