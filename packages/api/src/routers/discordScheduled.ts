import { prisma } from "@community-bot/db";
import { leadModProcedure, protectedProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function requireGuild(userId: string) {
  const guild = await prisma.discordGuild.findFirst({
    where: { userId },
  });

  if (!guild) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No Discord guild linked to your account.",
    });
  }

  return guild;
}

export const discordScheduledRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    return prisma.discordScheduledMessage.findMany({
      where: { guildId: guild.guildId },
      orderBy: { name: "asc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const schedule = await prisma.discordScheduledMessage.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      return schedule;
    }),

  create: leadModProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Name must be alphanumeric, underscore, or hyphen"
          ),
        channelId: z.string(),
        type: z.enum(["ONCE", "RECURRING"]),
        content: z.string().max(2000).optional(),
        embedJson: z.string().max(4000).optional(),
        cronExpression: z.string().max(100).optional(),
        templateId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);
      const name = input.name.toLowerCase();

      if (input.type === "RECURRING" && !input.cronExpression) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Recurring schedules require a cron expression.",
        });
      }

      if (!input.content && !input.embedJson && !input.templateId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide content, embed JSON, or a template.",
        });
      }

      const existing = await prisma.discordScheduledMessage.findUnique({
        where: { guildId_name: { guildId: guild.guildId, name } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Schedule "${name}" already exists.`,
        });
      }

      const schedule = await prisma.discordScheduledMessage.create({
        data: {
          guildId: guild.guildId,
          name,
          channelId: input.channelId,
          type: input.type,
          content: input.content,
          embedJson: input.embedJson,
          cronExpression: input.cronExpression,
          templateId: input.templateId,
          createdBy: ctx.session.user.id,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:scheduled-send", {
        scheduledMessageId: schedule.id,
        guildId: guild.guildId,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.schedule.create",
        resourceType: "DiscordScheduledMessage",
        resourceId: schedule.id,
        metadata: { name, type: input.type },
      });

      return schedule;
    }),

  update: leadModProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().max(2000).optional(),
        embedJson: z.string().max(4000).optional(),
        cronExpression: z.string().max(100).optional(),
        channelId: z.string().optional(),
        templateId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const schedule = await prisma.discordScheduledMessage.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      const updated = await prisma.discordScheduledMessage.update({
        where: { id: input.id },
        data: {
          ...(input.content !== undefined && { content: input.content }),
          ...(input.embedJson !== undefined && { embedJson: input.embedJson }),
          ...(input.cronExpression !== undefined && {
            cronExpression: input.cronExpression,
          }),
          ...(input.channelId !== undefined && { channelId: input.channelId }),
          ...(input.templateId !== undefined && {
            templateId: input.templateId,
          }),
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.schedule.update",
        resourceType: "DiscordScheduledMessage",
        resourceId: input.id,
        metadata: { name: schedule.name },
      });

      return updated;
    }),

  toggle: leadModProcedure
    .input(
      z.object({
        id: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const schedule = await prisma.discordScheduledMessage.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      const updated = await prisma.discordScheduledMessage.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: input.enabled
          ? "discord.schedule.enable"
          : "discord.schedule.disable",
        resourceType: "DiscordScheduledMessage",
        resourceId: input.id,
        metadata: { name: schedule.name },
      });

      return updated;
    }),

  delete: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const schedule = await prisma.discordScheduledMessage.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      await prisma.discordScheduledMessage.delete({
        where: { id: input.id },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.schedule.delete",
        resourceType: "DiscordScheduledMessage",
        resourceId: input.id,
        metadata: { name: schedule.name },
      });

      return { success: true };
    }),
});
