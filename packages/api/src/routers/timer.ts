import { db, eq, and, asc, twitchTimers } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

export const timerRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.twitchTimers.findMany({
      where: eq(twitchTimers.botChannelId, botChannel.id),
      orderBy: asc(twitchTimers.name),
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
        onlineIntervalSeconds: z.number().int().min(30).max(86400).default(300),
        offlineIntervalSeconds: z.number().int().min(30).max(86400).nullable().default(null),
        enabledWhenOnline: z.boolean().default(true),
        enabledWhenOffline: z.boolean().default(false),
        gameFilter: z.array(z.string().min(1).max(200)).max(20).default([]),
        titleKeywords: z.array(z.string().min(1).max(200)).max(20).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const name = input.name.toLowerCase();

      const existing = await db.query.twitchTimers.findFirst({
        where: and(eq(twitchTimers.name, name), eq(twitchTimers.botChannelId, botChannel.id)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Timer "${name}" already exists.`,
        });
      }

      const [timer] = await db.insert(twitchTimers).values({
        name,
        message: input.message,
        intervalMinutes: input.intervalMinutes,
        chatLines: input.chatLines,
        onlineIntervalSeconds: input.onlineIntervalSeconds,
        offlineIntervalSeconds: input.offlineIntervalSeconds,
        enabledWhenOnline: input.enabledWhenOnline,
        enabledWhenOffline: input.enabledWhenOffline,
        gameFilter: input.gameFilter,
        titleKeywords: input.titleKeywords,
        botChannelId: botChannel.id,
      }).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.create",
        resourceType: "TwitchTimer",
        resourceId: timer!.id,
        metadata: { name },
      });

      return timer!;
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
        onlineIntervalSeconds: z.number().int().min(30).max(86400).optional(),
        offlineIntervalSeconds: z.number().int().min(30).max(86400).nullable().optional(),
        enabledWhenOnline: z.boolean().optional(),
        enabledWhenOffline: z.boolean().optional(),
        gameFilter: z.array(z.string().min(1).max(200)).max(20).optional(),
        titleKeywords: z.array(z.string().min(1).max(200)).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const timer = await db.query.twitchTimers.findFirst({
        where: eq(twitchTimers.id, input.id),
      });

      if (!timer || timer.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timer not found.",
        });
      }

      const { id, name, ...rest } = input;

      const [updated] = await db.update(twitchTimers).set({
        ...rest,
        ...(name !== undefined ? { name: name.toLowerCase() } : {}),
      }).where(eq(twitchTimers.id, id)).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.update",
        resourceType: "TwitchTimer",
        resourceId: id,
        metadata: { name: updated!.name },
      });

      return updated!;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const timer = await db.query.twitchTimers.findFirst({
        where: eq(twitchTimers.id, input.id),
      });

      if (!timer || timer.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timer not found.",
        });
      }

      await db.delete(twitchTimers).where(eq(twitchTimers.id, input.id));

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

      const timer = await db.query.twitchTimers.findFirst({
        where: eq(twitchTimers.id, input.id),
      });

      if (!timer || timer.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timer not found.",
        });
      }

      const [updated] = await db.update(twitchTimers).set({ enabled: !timer.enabled }).where(eq(twitchTimers.id, input.id)).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("timer:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "timer.toggle",
        resourceType: "TwitchTimer",
        resourceId: input.id,
        metadata: { name: timer.name, enabled: updated!.enabled },
      });

      return updated!;
    }),
});
