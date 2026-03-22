import { db, eq, and, asc, desc, discordGuilds, discordCustomCommands, discordReports } from "@community-bot/db";
import {
  protectedProcedure,
  moderatorProcedure,
  leadModProcedure,
  router,
} from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";

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

export const discordCustomCommandsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    const commands = await db.query.discordCustomCommands.findMany({
      where: eq(discordCustomCommands.guildId, guild.guildId),
      orderBy: asc(discordCustomCommands.name),
    });

    return commands.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      response: c.response,
      embedJson: c.embedJson,
      ephemeral: c.ephemeral,
      enabled: c.enabled,
      allowedRoles: c.allowedRoles,
      useCount: c.useCount,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
    }));
  }),

  create: moderatorProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(32)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().max(100).default("A custom command"),
        response: z.string().min(1).max(2000),
        embedJson: z.string().nullable().default(null),
        ephemeral: z.boolean().default(false),
        allowedRoles: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const existing = await db.query.discordCustomCommands.findFirst({
        where: and(eq(discordCustomCommands.guildId, guild.guildId), eq(discordCustomCommands.name, input.name)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Command "${input.name}" already exists.`,
        });
      }

      const [cmd] = await db.insert(discordCustomCommands).values({
        guildId: guild.guildId,
        name: input.name,
        description: input.description,
        response: input.response,
        embedJson: input.embedJson,
        ephemeral: input.ephemeral,
        allowedRoles: input.allowedRoles,
        createdBy: ctx.session.user.id,
      }).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "discord.custom-command-create", resourceType: "DiscordCustomCommand", resourceId: cmd!.id, metadata: { name: input.name } },
      });

      return { id: cmd!.id, name: cmd!.name };
    }),

  update: moderatorProcedure
    .input(
      z.object({
        id: z.string().min(1),
        response: z.string().min(1).max(2000).optional(),
        description: z.string().max(100).optional(),
        embedJson: z.string().nullable().optional(),
        ephemeral: z.boolean().optional(),
        allowedRoles: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const cmd = await db.query.discordCustomCommands.findFirst({
        where: and(eq(discordCustomCommands.id, input.id), eq(discordCustomCommands.guildId, guild.guildId)),
      });

      if (!cmd) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      const { id: _, ...updateData } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) data[key] = value;
      }

      await db.update(discordCustomCommands).set(data).where(eq(discordCustomCommands.id, cmd.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.custom-command-update", resourceType: "DiscordCustomCommand", resourceId: cmd.id, metadata: { name: cmd.name } },
      });

      return { success: true };
    }),

  delete: leadModProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const cmd = await db.query.discordCustomCommands.findFirst({
        where: and(eq(discordCustomCommands.id, input.id), eq(discordCustomCommands.guildId, guild.guildId)),
      });

      if (!cmd) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      await db.delete(discordCustomCommands).where(eq(discordCustomCommands.id, cmd.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.custom-command-delete", resourceType: "DiscordCustomCommand", resourceId: cmd.id, metadata: { name: cmd.name } },
      });

      return { success: true };
    }),

  toggle: moderatorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const cmd = await db.query.discordCustomCommands.findFirst({
        where: and(eq(discordCustomCommands.id, input.id), eq(discordCustomCommands.guildId, guild.guildId)),
      });

      if (!cmd) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      await db.update(discordCustomCommands).set({ enabled: !cmd.enabled }).where(eq(discordCustomCommands.id, cmd.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.custom-command-toggle", resourceType: "DiscordCustomCommand", resourceId: cmd.id, metadata: { name: cmd.name, enabled: !cmd.enabled } },
      });

      return { enabled: !cmd.enabled };
    }),

  listReports: moderatorProcedure
    .input(
      z.object({
        status: z
          .enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"])
          .optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const conditions = [eq(discordReports.guildId, guild.guildId)];
      if (input.status) conditions.push(eq(discordReports.status, input.status));

      // Simple approach: fetch with ordering and limit
      const reports = await db.query.discordReports.findMany({
        where: and(...conditions),
        orderBy: desc(discordReports.createdAt),
        limit: input.limit + 1,
      });

      let nextCursor: string | undefined;
      if (reports.length > input.limit) {
        const next = reports.pop()!;
        nextCursor = next.id;
      }

      return {
        reports: reports.map((r) => ({
          id: r.id,
          reporterId: r.reporterId,
          reporterTag: r.reporterTag,
          targetId: r.targetId,
          targetTag: r.targetTag,
          reason: r.reason,
          status: r.status,
          resolvedBy: r.resolvedBy,
          resolution: r.resolution,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
        })),
        nextCursor,
      };
    }),

  updateReportStatus: moderatorProcedure
    .input(
      z.object({
        reportId: z.string().min(1),
        status: z.enum(["INVESTIGATING", "RESOLVED", "DISMISSED"]),
        resolution: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const report = await db.query.discordReports.findFirst({
        where: and(eq(discordReports.id, input.reportId), eq(discordReports.guildId, guild.guildId)),
      });

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found.",
        });
      }

      const isResolving =
        input.status === "RESOLVED" || input.status === "DISMISSED";

      await db.update(discordReports).set({
        status: input.status,
        ...(isResolving
          ? {
              resolvedBy: ctx.session.user.id,
              resolvedAt: new Date(),
              resolution: input.resolution,
            }
          : {}),
      }).where(eq(discordReports.id, report.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.report-update", resourceType: "DiscordReport", resourceId: report.id, metadata: { status: input.status } },
      });

      return { success: true };
    }),
});
