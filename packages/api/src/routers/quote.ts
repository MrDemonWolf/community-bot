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

export const quoteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return prisma.quote.findMany({
      where: { botChannelId: botChannel.id },
      orderBy: { quoteNumber: "asc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ quoteNumber: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const quote = await prisma.quote.findUnique({
        where: {
          quoteNumber_botChannelId: {
            quoteNumber: input.quoteNumber,
            botChannelId: botChannel.id,
          },
        },
      });

      if (!quote) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      }

      return quote;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      return prisma.quote.findMany({
        where: {
          botChannelId: botChannel.id,
          text: { contains: input.query, mode: "insensitive" },
        },
        orderBy: { quoteNumber: "asc" },
      });
    }),

  add: moderatorProcedure
    .input(
      z.object({
        text: z.string().min(1).max(500),
        game: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      // Get next quote number
      const last = await prisma.quote.findFirst({
        where: { botChannelId: botChannel.id },
        orderBy: { quoteNumber: "desc" },
        select: { quoteNumber: true },
      });
      const quoteNumber = (last?.quoteNumber ?? 0) + 1;

      const quote = await prisma.quote.create({
        data: {
          quoteNumber,
          text: input.text,
          game: input.game ?? null,
          addedBy: ctx.session.user.name,
          source: "web",
          botChannelId: botChannel.id,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("quote:created", { quoteId: quote.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "quote.add",
        resourceType: "Quote",
        resourceId: quote.id,
        metadata: { quoteNumber, text: input.text },
      });

      return quote;
    }),

  remove: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const quote = await prisma.quote.findUnique({
        where: { id: input.id },
      });

      if (!quote || quote.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      }

      await prisma.quote.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("quote:deleted", { quoteId: input.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "quote.remove",
        resourceType: "Quote",
        resourceId: input.id,
        metadata: { quoteNumber: quote.quoteNumber },
      });

      return { success: true };
    }),
});
