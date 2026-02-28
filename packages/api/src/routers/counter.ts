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

export const counterRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return prisma.twitchCounter.findMany({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const name = input.name.toLowerCase();

      const existing = await prisma.twitchCounter.findUnique({
        where: { name_botChannelId: { name, botChannelId: botChannel.id } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Counter "${name}" already exists.`,
        });
      }

      const counter = await prisma.twitchCounter.create({
        data: { name, botChannelId: botChannel.id },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("counter:updated", {
        counterName: name,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "counter.create",
        resourceType: "TwitchCounter",
        resourceId: counter.id,
        metadata: { name },
      });

      return counter;
    }),

  update: moderatorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        value: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const counter = await prisma.twitchCounter.findUnique({
        where: { id: input.id },
      });

      if (!counter || counter.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Counter not found.",
        });
      }

      const updated = await prisma.twitchCounter.update({
        where: { id: input.id },
        data: { value: input.value },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("counter:updated", {
        counterName: counter.name,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "counter.update",
        resourceType: "TwitchCounter",
        resourceId: input.id,
        metadata: { name: counter.name, value: input.value },
      });

      return updated;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const counter = await prisma.twitchCounter.findUnique({
        where: { id: input.id },
      });

      if (!counter || counter.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Counter not found.",
        });
      }

      await prisma.twitchCounter.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("counter:updated", {
        counterName: counter.name,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "counter.delete",
        resourceType: "TwitchCounter",
        resourceId: input.id,
        metadata: { name: counter.name },
      });

      return { success: true };
    }),
});
