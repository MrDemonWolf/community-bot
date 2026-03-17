import { db, eq, channelPointRewards } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

const actionTypeEnum = z.enum([
  "RUN_COMMAND",
  "ADD_TO_QUEUE",
  "SONG_REQUEST",
  "CUSTOM_MESSAGE",
  "SHOUTOUT",
  "HIGHLIGHT",
]);

export const channelPointsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);
    return db.query.channelPointRewards.findMany({
      where: eq(channelPointRewards.botChannelId, botChannel.id),
    });
  }),

  create: moderatorProcedure
    .input(
      z.object({
        title: z.string().min(1).max(45),
        cost: z.number().int().min(1).max(1000000),
        prompt: z.string().max(200).optional(),
        backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        requireUserInput: z.boolean().default(false),
        actionType: actionTypeEnum.default("CUSTOM_MESSAGE"),
        actionConfig: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const [reward] = await db
        .insert(channelPointRewards)
        .values({ ...input, botChannelId: botChannel.id, syncStatus: "pending" })
        .returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("channel-points:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "channel-points.create",
        resourceType: "ChannelPointReward",
        resourceId: reward!.id,
        metadata: { title: input.title },
      });

      return reward!;
    }),

  update: moderatorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(45).optional(),
        cost: z.number().int().min(1).max(1000000).optional(),
        prompt: z.string().max(200).nullable().optional(),
        backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        isEnabled: z.boolean().optional(),
        requireUserInput: z.boolean().optional(),
        actionType: actionTypeEnum.optional(),
        actionConfig: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const reward = await db.query.channelPointRewards.findFirst({
        where: eq(channelPointRewards.id, input.id),
      });

      if (!reward || reward.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found." });
      }

      const { id, ...fields } = input;
      const [updated] = await db
        .update(channelPointRewards)
        .set({ ...fields, syncStatus: "pending" })
        .where(eq(channelPointRewards.id, id))
        .returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("channel-points:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "channel-points.update",
        resourceType: "ChannelPointReward",
        resourceId: id,
        metadata: { title: updated!.title },
      });

      return updated!;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const reward = await db.query.channelPointRewards.findFirst({
        where: eq(channelPointRewards.id, input.id),
      });

      if (!reward || reward.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found." });
      }

      await db.delete(channelPointRewards).where(eq(channelPointRewards.id, input.id));

      const { eventBus } = await import("../events");
      await eventBus.publish("channel-points:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "channel-points.delete",
        resourceType: "ChannelPointReward",
        resourceId: input.id,
        metadata: { title: reward.title },
      });

      return { success: true };
    }),
});
