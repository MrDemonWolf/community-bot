import { prisma } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function getUserBotChannel(userId: string) {
  const botChannel = await prisma.botChannel.findUnique({
    where: { userId },
  });

  if (!botChannel || !botChannel.enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Bot is not enabled for your channel.",
    });
  }

  return botChannel;
}

export const timerRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return prisma.twitchTimer.findMany({
      where: { botChannelId: botChannel.id },
      orderBy: { name: "asc" },
    });
  }),

  create: moderatorProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric, underscore, or hyphen"),
        message: z.string().min(1).max(500),
        intervalMinutes: z.number().int().min(1).max(1440).default(5),
        chatLines: z.number().int().min(0).max(1000).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const name = input.name.toLowerCase();

      const existing = await prisma.twitchTimer.findUnique({
        where: { name_botChannelId: { name, botChannelId: botChannel.id } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Timer "${name}" already exists.`,
        });
      }

      const timer = await prisma.twitchTimer.create({
        data: {
          name,
          message: input.message,
          intervalMinutes: input.intervalMinutes,
          chatLines: input.chatLines,
          botChannelId: botChannel.id,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.create",
        resourceType: "TwitchTimer",
        resourceId: timer.id,
        metadata: { name },
      });

      return timer;
    }),

  update: moderatorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric, underscore, or hyphen")
          .optional(),
        message: z.string().min(1).max(500).optional(),
        intervalMinutes: z.number().int().min(1).max(1440).optional(),
        chatLines: z.number().int().min(0).max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const timer = await prisma.twitchTimer.findUnique({
        where: { id: input.id },
      });

      if (!timer || timer.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timer not found.",
        });
      }

      const { id, name, ...rest } = input;

      const updated = await prisma.twitchTimer.update({
        where: { id },
        data: {
          ...rest,
          ...(name !== undefined ? { name: name.toLowerCase() } : {}),
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.update",
        resourceType: "TwitchTimer",
        resourceId: id,
        metadata: { name: updated.name },
      });

      return updated;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const timer = await prisma.twitchTimer.findUnique({
        where: { id: input.id },
      });

      if (!timer || timer.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timer not found.",
        });
      }

      await prisma.twitchTimer.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.delete",
        resourceType: "TwitchTimer",
        resourceId: input.id,
        metadata: { name: timer.name },
      });

      return { success: true };
    }),

  toggleEnabled: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const timer = await prisma.twitchTimer.findUnique({
        where: { id: input.id },
      });

      if (!timer || timer.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timer not found.",
        });
      }

      const updated = await prisma.twitchTimer.update({
        where: { id: input.id },
        data: { enabled: !timer.enabled },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.toggle",
        resourceType: "TwitchTimer",
        resourceId: input.id,
        metadata: { name: timer.name, enabled: updated.enabled },
      });

      return updated;
    }),
});
