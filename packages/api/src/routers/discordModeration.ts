import { db, eq, and, or, asc, desc, ilike, count, discordGuilds, discordCases, discordCaseNotes, discordWarnThresholds } from "@community-bot/db";
import { moderatorProcedure, leadModProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function requireGuild(userId: string) {
  const guild = await db.query.discordGuilds.findFirst({ where: eq(discordGuilds.userId, userId) });
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

      const conditions = [eq(discordCases.guildId, guild.guildId)];
      if (input.targetId) conditions.push(eq(discordCases.targetId, input.targetId));
      if (input.moderatorId) conditions.push(eq(discordCases.moderatorId, input.moderatorId));
      if (input.type) conditions.push(eq(discordCases.type, input.type));
      if (input.resolved !== undefined) conditions.push(eq(discordCases.resolved, input.resolved));
      if (input.search) {
        conditions.push(
          or(
            ilike(discordCases.reason, `%${input.search}%`),
            ilike(discordCases.targetTag, `%${input.search}%`),
            ilike(discordCases.moderatorTag, `%${input.search}%`),
          )!
        );
      }

      const whereClause = and(...conditions);

      const cases = await db.query.discordCases.findMany({
        where: whereClause,
        orderBy: desc(discordCases.caseNumber),
        limit: input.limit + 1,
      });

      let nextCursor: string | undefined;
      if (cases.length > input.limit) {
        const next = cases.pop()!;
        nextCursor = next.id;
      }

      // Get note counts for all cases
      const caseIds = cases.map((c) => c.id);
      const noteCounts: Record<string, number> = {};
      if (caseIds.length > 0) {
        for (const c of cases) {
          const noteResult = await db.select({ value: count() }).from(discordCaseNotes).where(eq(discordCaseNotes.caseId, c.id));
          noteCounts[c.id] = noteResult[0]?.value ?? 0;
        }
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
          noteCount: noteCounts[c.id] ?? 0,
        })),
        nextCursor,
      };
    }),

  getCase: moderatorProcedure
    .input(z.object({ caseNumber: z.number().min(1) }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const modCase = await db.query.discordCases.findFirst({
        where: and(
          eq(discordCases.guildId, guild.guildId),
          eq(discordCases.caseNumber, input.caseNumber),
        ),
        with: {
          notes: true,
        },
      });

      if (!modCase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Case #${input.caseNumber} not found.`,
        });
      }

      // Sort notes by createdAt ascending
      const sortedNotes = [...modCase.notes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

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
        notes: sortedNotes.map((n) => ({
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

      const modCase = await db.query.discordCases.findFirst({
        where: and(
          eq(discordCases.guildId, guild.guildId),
          eq(discordCases.caseNumber, input.caseNumber),
        ),
      });

      if (!modCase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Case #${input.caseNumber} not found.`,
        });
      }

      await db.insert(discordCaseNotes).values({
        caseId: modCase.id,
        authorId: ctx.session.user.id,
        authorTag: ctx.session.user.name,
        content: input.content,
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

    const thresholds = await db.query.discordWarnThresholds.findMany({
      where: eq(discordWarnThresholds.guildId, guild.guildId),
      orderBy: asc(discordWarnThresholds.count),
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

      await db.insert(discordWarnThresholds).values({
        guildId: guild.guildId,
        count: input.count,
        action: input.action,
        duration: input.action === "MUTE" ? input.duration : null,
      }).onConflictDoUpdate({
        target: [discordWarnThresholds.guildId, discordWarnThresholds.count],
        set: {
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

      const result = await db.delete(discordWarnThresholds).where(
        and(
          eq(discordWarnThresholds.guildId, guild.guildId),
          eq(discordWarnThresholds.count, input.count),
        )
      ).returning();

      if (result.length === 0) {
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
