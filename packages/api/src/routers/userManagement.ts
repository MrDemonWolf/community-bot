import { prisma } from "@community-bot/db";
import { broadcasterProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

export const userManagementRouter = router({
  list: broadcasterProcedure
    .input(
      z
        .object({
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(25),
          search: z.string().optional(),
          role: z
            .enum(["USER", "MODERATOR", "LEAD_MODERATOR", "BROADCASTER"])
            .optional(),
          banned: z.boolean().optional(),
        })
        .default({ skip: 0, take: 25 })
    )
    .query(async ({ input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.role) {
        where.role = input.role;
      }

      if (input.banned !== undefined) {
        where.banned = input.banned;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: input.skip,
          take: input.take,
          include: {
            accounts: {
              select: { providerId: true, accountId: true },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          role: u.role,
          banned: u.banned,
          bannedAt: u.bannedAt?.toISOString() ?? null,
          banReason: u.banReason,
          createdAt: u.createdAt.toISOString(),
          connectedAccounts: u.accounts.map((a) => ({
            provider: a.providerId,
            accountId: a.accountId,
          })),
        })),
        total,
      };
    }),

  getUser: broadcasterProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        include: {
          accounts: {
            select: { providerId: true, accountId: true },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        banned: user.banned,
        bannedAt: user.bannedAt?.toISOString() ?? null,
        banReason: user.banReason,
        createdAt: user.createdAt.toISOString(),
        connectedAccounts: user.accounts.map((a) => ({
          provider: a.providerId,
          accountId: a.accountId,
        })),
      };
    }),

  updateRole: broadcasterProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["USER", "MODERATOR", "LEAD_MODERATOR"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role.",
        });
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      if (target.role === "BROADCASTER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change the broadcaster's role.",
        });
      }

      const previousRole = target.role;

      await prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "user.role-change",
        resourceType: "User",
        resourceId: input.userId,
        metadata: {
          targetName: target.name,
          previousRole,
          newRole: input.role,
        },
      });

      return { success: true };
    }),

  ban: broadcasterProcedure
    .input(
      z.object({
        userId: z.string(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot ban yourself.",
        });
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      if (target.role === "BROADCASTER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot ban the broadcaster.",
        });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: {
          banned: true,
          bannedAt: new Date(),
          banReason: input.reason ?? null,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "user.ban",
        resourceType: "User",
        resourceId: input.userId,
        metadata: {
          targetName: target.name,
          reason: input.reason ?? null,
        },
      });

      return { success: true };
    }),

  unban: broadcasterProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: {
          banned: false,
          bannedAt: null,
          banReason: null,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "user.unban",
        resourceType: "User",
        resourceId: input.userId,
        metadata: { targetName: target.name },
      });

      return { success: true };
    }),
});
