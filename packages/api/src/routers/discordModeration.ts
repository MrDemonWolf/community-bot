import { prisma } from "@community-bot/db";
import { moderatorProcedure, leadModProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function requireGuild(userId: string) {
  const guild = await prisma.discordGuild.findFirst({ where: { userId } });
  if (!guild) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No Discord server linked.",
    });
  }
  return guild;
}

export const discordModerationRouter = router({
  listCases: moderatorProcedure
    .input(
      z.object({
        targetId: z.string().optional(),
        moderatorId: z.string().optional(),
        type: z
          .enum([
            "BAN",
            "TEMPBAN",
            "KICK",
            "WARN",
            "MUTE",
            "UNBAN",
            "UNWARN",
            "UNMUTE",
            "NOTE",
          ])
          .optional(),
        resolved: z.boolean().optional(),
        search: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const where: Record<string, unknown> = { guildId: guild.guildId };
      if (input.targetId) where.targetId = input.targetId;
      if (input.moderatorId) where.moderatorId = input.moderatorId;
      if (input.type) where.type = input.type;
      if (input.resolved !== undefined) where.resolved = input.resolved;
      if (input.search) {
        where.OR = [
          { reason: { contains: input.search, mode: "insensitive" } },
          { targetTag: { contains: input.search, mode: "insensitive" } },
          { moderatorTag: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const cases = await prisma.discordCase.findMany({
        where,
        orderBy: { caseNumber: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { _count: { select: { notes: true } } },
      });

      let nextCursor: string | undefined;
      if (cases.length > input.limit) {
        const next = cases.pop()!;
        nextCursor = next.id;
      }

      return {
        cases: cases.map((c) => ({
          id: c.id,
          caseNumber: c.caseNumber,
          type: c.type,
          targetId: c.targetId,
          targetTag: c.targetTag,
          moderatorId: c.moderatorId,
          moderatorTag: c.moderatorTag,
          reason: c.reason,
          duration: c.duration,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          resolved: c.resolved,
          resolvedBy: c.resolvedBy,
          resolvedAt: c.resolvedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          noteCount: c._count.notes,
        })),
        nextCursor,
      };
    }),

  getCase: moderatorProcedure
    .input(z.object({ caseNumber: z.number().min(1) }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const modCase = await prisma.discordCase.findUnique({
        where: {
          guildId_caseNumber: {
            guildId: guild.guildId,
            caseNumber: input.caseNumber,
          },
        },
        include: {
          notes: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!modCase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Case #${input.caseNumber} not found.`,
        });
      }

      return {
        id: modCase.id,
        caseNumber: modCase.caseNumber,
        type: modCase.type,
        targetId: modCase.targetId,
        targetTag: modCase.targetTag,
        moderatorId: modCase.moderatorId,
        moderatorTag: modCase.moderatorTag,
        reason: modCase.reason,
        duration: modCase.duration,
        expiresAt: modCase.expiresAt?.toISOString() ?? null,
        resolved: modCase.resolved,
        resolvedBy: modCase.resolvedBy,
        resolvedAt: modCase.resolvedAt?.toISOString() ?? null,
        createdAt: modCase.createdAt.toISOString(),
        notes: modCase.notes.map((n) => ({
          id: n.id,
          authorId: n.authorId,
          authorTag: n.authorTag,
          content: n.content,
          createdAt: n.createdAt.toISOString(),
        })),
      };
    }),

  addNote: moderatorProcedure
    .input(
      z.object({
        caseNumber: z.number().min(1),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const modCase = await prisma.discordCase.findUnique({
        where: {
          guildId_caseNumber: {
            guildId: guild.guildId,
            caseNumber: input.caseNumber,
          },
        },
      });

      if (!modCase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Case #${input.caseNumber} not found.`,
        });
      }

      await prisma.discordCaseNote.create({
        data: {
          caseId: modCase.id,
          authorId: ctx.session.user.id,
          authorTag: ctx.session.user.name,
          content: input.content,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.case-note",
        resourceType: "DiscordCase",
        resourceId: modCase.id,
        metadata: { caseNumber: input.caseNumber },
      });

      return { success: true };
    }),

  listThresholds: moderatorProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    const thresholds = await prisma.discordWarnThreshold.findMany({
      where: { guildId: guild.guildId },
      orderBy: { count: "asc" },
    });

    return thresholds.map((t) => ({
      id: t.id,
      count: t.count,
      action: t.action,
      duration: t.duration,
    }));
  }),

  setThreshold: leadModProcedure
    .input(
      z.object({
        count: z.number().min(1).max(50),
        action: z.enum(["BAN", "KICK", "MUTE"]),
        duration: z.number().min(1).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      if (input.action === "MUTE" && !input.duration) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duration is required for Mute action.",
        });
      }

      await prisma.discordWarnThreshold.upsert({
        where: {
          guildId_count: { guildId: guild.guildId, count: input.count },
        },
        create: {
          guildId: guild.guildId,
          count: input.count,
          action: input.action,
          duration: input.action === "MUTE" ? input.duration : null,
        },
        update: {
          action: input.action,
          duration: input.action === "MUTE" ? input.duration : null,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.threshold-set",
        resourceType: "DiscordWarnThreshold",
        resourceId: guild.guildId,
        metadata: input,
      });

      return { success: true };
    }),

  deleteThreshold: leadModProcedure
    .input(z.object({ count: z.number().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const deleted = await prisma.discordWarnThreshold.deleteMany({
        where: { guildId: guild.guildId, count: input.count },
      });

      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No threshold at ${input.count} warnings.`,
        });
      }

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.threshold-delete",
        resourceType: "DiscordWarnThreshold",
        resourceId: guild.guildId,
        metadata: { count: input.count },
      });

      return { success: true };
    }),
});
