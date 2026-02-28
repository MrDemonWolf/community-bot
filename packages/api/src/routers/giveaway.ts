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

export const giveawayRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const giveaways = await prisma.giveaway.findMany({
      where: { botChannelId: botChannel.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { entries: true } } },
    });

    return giveaways.map((g) => ({
      id: g.id,
      title: g.title,
      keyword: g.keyword,
      isActive: g.isActive,
      winnerName: g.winnerName,
      entryCount: g._count.entries,
      createdAt: g.createdAt.toISOString(),
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const giveaway = await prisma.giveaway.findUnique({
        where: { id: input.id },
        include: { entries: { orderBy: { createdAt: "asc" } } },
      });

      if (!giveaway || giveaway.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Giveaway not found" });
      }

      return giveaway;
    }),

  create: moderatorProcedure
    .input(z.object({ title: z.string().min(1), keyword: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      // End any active giveaway first
      await prisma.giveaway.updateMany({
        where: { botChannelId: botChannel.id, isActive: true },
        data: { isActive: false },
      });

      const giveaway = await prisma.giveaway.create({
        data: {
          botChannelId: botChannel.id,
          title: input.title,
          keyword: input.keyword.toLowerCase(),
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("giveaway:started", {
        giveawayId: giveaway.id,
        channelId: botChannel.twitchUserId,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "giveaway.create",
        resourceType: "Giveaway",
        resourceId: giveaway.id,
        metadata: { title: input.title, keyword: input.keyword },
      });

      return giveaway;
    }),

  draw: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const giveaway = await prisma.giveaway.findFirst({
      where: { botChannelId: botChannel.id, isActive: true },
      include: { entries: true },
    });

    if (!giveaway || giveaway.entries.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active giveaway or no entries.",
      });
    }

    const randomIndex = Math.floor(Math.random() * giveaway.entries.length);
    const winner = giveaway.entries[randomIndex];

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { winnerName: winner.twitchUsername },
    });

    const { eventBus } = await import("../events");
    await eventBus.publish("giveaway:winner", {
      giveawayId: giveaway.id,
      channelId: botChannel.twitchUserId,
    });

    await logAudit({
      userId: ctx.session.user.id,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "giveaway.draw",
      resourceType: "Giveaway",
      resourceId: giveaway.id,
      metadata: { winner: winner.twitchUsername },
    });

    return { winner: winner.twitchUsername };
  }),

  end: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const giveaway = await prisma.giveaway.findFirst({
      where: { botChannelId: botChannel.id, isActive: true },
    });

    if (!giveaway) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active giveaway.",
      });
    }

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { isActive: false },
    });

    const { eventBus } = await import("../events");
    await eventBus.publish("giveaway:ended", {
      giveawayId: giveaway.id,
      channelId: botChannel.twitchUserId,
    });

    await logAudit({
      userId: ctx.session.user.id,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "giveaway.end",
      resourceType: "Giveaway",
      resourceId: giveaway.id,
    });

    return { success: true };
  }),
});
