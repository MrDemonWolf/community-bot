import { prisma } from "@community-bot/db";
import {
  protectedProcedure,
  moderatorProcedure,
  leadModProcedure,
  router,
} from "../index";
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

export const discordCustomCommandsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    const commands = await prisma.discordCustomCommand.findMany({
      where: { guildId: guild.guildId },
      orderBy: { name: "asc" },
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

      const existing = await prisma.discordCustomCommand.findUnique({
        where: {
          guildId_name: { guildId: guild.guildId, name: input.name },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Command "${input.name}" already exists.`,
        });
      }

      const cmd = await prisma.discordCustomCommand.create({
        data: {
          guildId: guild.guildId,
          name: input.name,
          description: input.description,
          response: input.response,
          embedJson: input.embedJson,
          ephemeral: input.ephemeral,
          allowedRoles: input.allowedRoles,
          createdBy: ctx.session.user.id,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.custom-command-create",
        resourceType: "DiscordCustomCommand",
        resourceId: cmd.id,
        metadata: { name: input.name },
      });

      return { id: cmd.id, name: cmd.name };
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

      const cmd = await prisma.discordCustomCommand.findFirst({
        where: { id: input.id, guildId: guild.guildId },
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

      await prisma.discordCustomCommand.update({
        where: { id: cmd.id },
        data,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.custom-command-update",
        resourceType: "DiscordCustomCommand",
        resourceId: cmd.id,
        metadata: { name: cmd.name },
      });

      return { success: true };
    }),

  delete: leadModProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const cmd = await prisma.discordCustomCommand.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!cmd) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      await prisma.discordCustomCommand.delete({ where: { id: cmd.id } });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.custom-command-delete",
        resourceType: "DiscordCustomCommand",
        resourceId: cmd.id,
        metadata: { name: cmd.name },
      });

      return { success: true };
    }),

  toggle: moderatorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const cmd = await prisma.discordCustomCommand.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!cmd) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      await prisma.discordCustomCommand.update({
        where: { id: cmd.id },
        data: { enabled: !cmd.enabled },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.custom-command-toggle",
        resourceType: "DiscordCustomCommand",
        resourceId: cmd.id,
        metadata: { name: cmd.name, enabled: !cmd.enabled },
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

      const where: Record<string, unknown> = { guildId: guild.guildId };
      if (input.status) where.status = input.status;

      const reports = await prisma.discordReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
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

      const report = await prisma.discordReport.findFirst({
        where: { id: input.reportId, guildId: guild.guildId },
      });

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found.",
        });
      }

      const isResolving =
        input.status === "RESOLVED" || input.status === "DISMISSED";

      await prisma.discordReport.update({
        where: { id: report.id },
        data: {
          status: input.status,
          ...(isResolving
            ? {
                resolvedBy: ctx.session.user.id,
                resolvedAt: new Date(),
                resolution: input.resolution,
              }
            : {}),
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.report-update",
        resourceType: "DiscordReport",
        resourceId: report.id,
        metadata: { status: input.status },
      });

      return { success: true };
    }),
});
