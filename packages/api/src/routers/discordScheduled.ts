import { db, eq, and, asc, discordGuilds, discordScheduledMessages, discordMessageTemplates } from "@community-bot/db";
import { leadModProcedure, protectedProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";

async function requireGuild(userId: string) {
  const guild = await db.query.discordGuilds.findFirst({
    where: eq(discordGuilds.userId, userId),
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

    return db.query.discordScheduledMessages.findMany({
      where: eq(discordScheduledMessages.guildId, guild.guildId),
      orderBy: asc(discordScheduledMessages.name),
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const schedule = await db.query.discordScheduledMessages.findFirst({
        where: and(eq(discordScheduledMessages.id, input.id), eq(discordScheduledMessages.guildId, guild.guildId)),
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

      if (input.embedJson) {
        try {
          JSON.parse(input.embedJson);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid embed JSON.",
          });
        }
      }

      if (input.templateId) {
        const template = await db.query.discordMessageTemplates.findFirst({
          where: and(eq(discordMessageTemplates.id, input.templateId), eq(discordMessageTemplates.guildId, guild.guildId)),
        });
        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found in this guild.",
          });
        }
      }

      const existing = await db.query.discordScheduledMessages.findFirst({
        where: and(eq(discordScheduledMessages.guildId, guild.guildId), eq(discordScheduledMessages.name, name)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Schedule "${name}" already exists.`,
        });
      }

      const [schedule] = await db.insert(discordScheduledMessages).values({
        guildId: guild.guildId,
        name,
        channelId: input.channelId,
        type: input.type,
        content: input.content,
        embedJson: input.embedJson,
        cronExpression: input.cronExpression,
        templateId: input.templateId,
        createdBy: ctx.session.user.id,
      }).returning();

      await applyMutationEffects(ctx, {
        event: { name: "discord:scheduled-send", payload: { scheduledMessageId: schedule!.id, guildId: guild.guildId } },
        audit: { action: "discord.schedule.create", resourceType: "DiscordScheduledMessage", resourceId: schedule!.id, metadata: { name, type: input.type } },
      });

      return schedule!;
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

      const schedule = await db.query.discordScheduledMessages.findFirst({
        where: and(eq(discordScheduledMessages.id, input.id), eq(discordScheduledMessages.guildId, guild.guildId)),
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      if (input.embedJson) {
        try {
          JSON.parse(input.embedJson);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid embed JSON.",
          });
        }
      }

      if (input.templateId) {
        const template = await db.query.discordMessageTemplates.findFirst({
          where: and(eq(discordMessageTemplates.id, input.templateId), eq(discordMessageTemplates.guildId, guild.guildId)),
        });
        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found in this guild.",
          });
        }
      }

      const [updated] = await db.update(discordScheduledMessages).set({
        ...(input.content !== undefined && { content: input.content }),
        ...(input.embedJson !== undefined && { embedJson: input.embedJson }),
        ...(input.cronExpression !== undefined && {
          cronExpression: input.cronExpression,
        }),
        ...(input.channelId !== undefined && { channelId: input.channelId }),
        ...(input.templateId !== undefined && {
          templateId: input.templateId,
        }),
      }).where(eq(discordScheduledMessages.id, input.id)).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "discord.schedule.update", resourceType: "DiscordScheduledMessage", resourceId: input.id, metadata: { name: schedule.name } },
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

      const schedule = await db.query.discordScheduledMessages.findFirst({
        where: and(eq(discordScheduledMessages.id, input.id), eq(discordScheduledMessages.guildId, guild.guildId)),
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      const [updated] = await db.update(discordScheduledMessages).set({ enabled: input.enabled }).where(eq(discordScheduledMessages.id, input.id)).returning();

      await applyMutationEffects(ctx, {
        audit: { action: input.enabled ? "discord.schedule.enable" : "discord.schedule.disable", resourceType: "DiscordScheduledMessage", resourceId: input.id, metadata: { name: schedule.name } },
      });

      return updated;
    }),

  delete: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const schedule = await db.query.discordScheduledMessages.findFirst({
        where: and(eq(discordScheduledMessages.id, input.id), eq(discordScheduledMessages.guildId, guild.guildId)),
      });

      if (!schedule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled message not found.",
        });
      }

      await db.delete(discordScheduledMessages).where(eq(discordScheduledMessages.id, input.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.schedule.delete", resourceType: "DiscordScheduledMessage", resourceId: input.id, metadata: { name: schedule.name } },
      });

      return { success: true };
    }),
});
