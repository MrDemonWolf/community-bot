import { db, eq, and, desc, count, giveaways, giveawayEntries } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

export const giveawayRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const giveawayList = await db.query.giveaways.findMany({
      where: eq(giveaways.botChannelId, botChannel.id),
      orderBy: desc(giveaways.createdAt),
    });

    // Get entry counts for each giveaway
    const results = await Promise.all(
      giveawayList.map(async (g) => {
        const entryResult = await db.select({ value: count() }).from(giveawayEntries).where(eq(giveawayEntries.giveawayId, g.id));
        const entryCount = entryResult[0]?.value ?? 0;
        return {
          id: g.id,
          title: g.title,
          keyword: g.keyword,
          isActive: g.isActive,
          winnerName: g.winnerName,
          entryCount,
          createdAt: g.createdAt.toISOString(),
        };
      })
    );

    return results;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const giveaway = await db.query.giveaways.findFirst({
        where: eq(giveaways.id, input.id),
        with: { entries: true },
      });

      if (!giveaway || giveaway.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Giveaway not found" });
      }

      // Sort entries by createdAt ascending
      giveaway.entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return giveaway;
    }),

  create: moderatorProcedure
    .input(z.object({ title: z.string().min(1), keyword: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      // End any active giveaway first
      await db.update(giveaways).set({ isActive: false }).where(and(eq(giveaways.botChannelId, botChannel.id), eq(giveaways.isActive, true)));

      const [giveaway] = await db.insert(giveaways).values({
        botChannelId: botChannel.id,
        title: input.title,
        keyword: input.keyword.toLowerCase(),
      }).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("giveaway:started", {
        giveawayId: giveaway!.id,
        channelId: botChannel.twitchUserId,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "giveaway.create",
        resourceType: "Giveaway",
        resourceId: giveaway!.id,
        metadata: { title: input.title, keyword: input.keyword },
      });

      return giveaway!;
    }),

  draw: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const giveaway = await db.query.giveaways.findFirst({
      where: and(eq(giveaways.botChannelId, botChannel.id), eq(giveaways.isActive, true)),
      with: { entries: true },
    });

    if (!giveaway || giveaway.entries.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active giveaway or no entries.",
      });
    }

    const randomIndex = Math.floor(Math.random() * giveaway.entries.length);
    const winner = giveaway.entries[randomIndex];

    await db.update(giveaways).set({ winnerName: winner!.twitchUsername }).where(eq(giveaways.id, giveaway.id));

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
      metadata: { winner: winner!.twitchUsername },
    });

    return { winner: winner!.twitchUsername };
  }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const giveaway = await db.query.giveaways.findFirst({
        where: eq(giveaways.id, input.id),
      });

      if (!giveaway || giveaway.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Giveaway not found." });
      }

      await db.delete(giveaways).where(eq(giveaways.id, input.id));

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "giveaway.delete",
        resourceType: "Giveaway",
        resourceId: input.id,
        metadata: { title: giveaway.title },
      });

      return { success: true };
    }),

  end: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const giveaway = await db.query.giveaways.findFirst({
      where: and(eq(giveaways.botChannelId, botChannel.id), eq(giveaways.isActive, true)),
    });

    if (!giveaway) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active giveaway.",
      });
    }

    await db.update(giveaways).set({ isActive: false }).where(eq(giveaways.id, giveaway.id));

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
