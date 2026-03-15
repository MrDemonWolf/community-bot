import { db, eq, and, asc, twitchCounters } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

export const counterRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.twitchCounters.findMany({
      where: eq(twitchCounters.botChannelId, botChannel.id),
      orderBy: asc(twitchCounters.name),
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

      const existing = await db.query.twitchCounters.findFirst({
        where: and(eq(twitchCounters.name, name), eq(twitchCounters.botChannelId, botChannel.id)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Counter "${name}" already exists.`,
        });
      }

      const [counter] = await db.insert(twitchCounters).values({
        name,
        botChannelId: botChannel.id,
      }).returning();

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
        resourceId: counter!.id,
        metadata: { name },
      });

      return counter!;
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

      const counter = await db.query.twitchCounters.findFirst({
        where: eq(twitchCounters.id, input.id),
      });

      if (!counter || counter.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Counter not found.",
        });
      }

      const [updated] = await db.update(twitchCounters).set({ value: input.value }).where(eq(twitchCounters.id, input.id)).returning();

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

      const counter = await db.query.twitchCounters.findFirst({
        where: eq(twitchCounters.id, input.id),
      });

      if (!counter || counter.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Counter not found.",
        });
      }

      await db.delete(twitchCounters).where(eq(twitchCounters.id, input.id));

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
