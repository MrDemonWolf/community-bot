import { db, eq, or, and, desc, count, ilike, users } from "@community-bot/db";
import { broadcasterProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";

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
      const conditions = [];

      if (input.search) {
        conditions.push(
          or(
            ilike(users.name, `%${input.search}%`),
            ilike(users.email, `%${input.search}%`),
          )
        );
      }

      if (input.role) {
        conditions.push(eq(users.role, input.role));
      }

      if (input.banned !== undefined) {
        conditions.push(eq(users.banned, input.banned));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [userList, totalResult] = await Promise.all([
        db.query.users.findMany({
          where: whereClause,
          orderBy: desc(users.createdAt),
          offset: input.skip,
          limit: input.take,
          with: {
            accounts: true,
          },
        }),
        db.select({ value: count() }).from(users).where(whereClause),
      ]);

      const total = totalResult[0]?.value ?? 0;

      return {
        users: userList.map((u) => ({
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
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        with: {
          accounts: true,
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

      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
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

      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));

      await applyMutationEffects(ctx, {
        audit: { action: "user.role-change", resourceType: "User", resourceId: input.userId, metadata: { targetName: target.name, previousRole, newRole: input.role } },
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

      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
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

      await db.update(users).set({
        banned: true,
        bannedAt: new Date(),
        banReason: input.reason ?? null,
      }).where(eq(users.id, input.userId));

      await applyMutationEffects(ctx, {
        audit: { action: "user.ban", resourceType: "User", resourceId: input.userId, metadata: { targetName: target.name, reason: input.reason ?? null } },
      });

      return { success: true };
    }),

  unban: broadcasterProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      await db.update(users).set({
        banned: false,
        bannedAt: null,
        banReason: null,
      }).where(eq(users.id, input.userId));

      await applyMutationEffects(ctx, {
        audit: { action: "user.unban", resourceType: "User", resourceId: input.userId, metadata: { targetName: target.name } },
      });

      return { success: true };
    }),

  delete: broadcasterProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete yourself.",
        });
      }

      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      if (target.role === "BROADCASTER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the broadcaster.",
        });
      }

      await db.delete(users).where(eq(users.id, input.userId));

      await applyMutationEffects(ctx, {
        audit: { action: "user.delete", resourceType: "User", resourceId: input.userId, metadata: { targetName: target.name } },
      });

      return { success: true };
    }),
});
