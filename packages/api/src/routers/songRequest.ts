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

export const songRequestRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return prisma.songRequest.findMany({
      where: { botChannelId: botChannel.id },
      orderBy: { position: "asc" },
    });
  }),

  current: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return prisma.songRequest.findFirst({
      where: { botChannelId: botChannel.id, position: 1 },
    });
  }),

  skip: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const entry = await prisma.songRequest.findFirst({
      where: { botChannelId: botChannel.id, position: 1 },
    });

    if (!entry) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No song request to skip.",
      });
    }

    await prisma.songRequest.delete({ where: { id: entry.id } });

    await prisma.$executeRawUnsafe(
      `UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = $1 AND position > 1`,
      botChannel.id
    );

    const { eventBus } = await import("../events");
    await eventBus.publish("song-request:updated", { channelId: botChannel.id });

    await logAudit({
      userId: ctx.session.user.id,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "song-request.skip",
      resourceType: "SongRequest",
      resourceId: entry.id,
      metadata: { title: entry.title },
    });

    return { success: true };
  }),

  remove: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const entry = await prisma.songRequest.findUnique({
        where: { id: input.id },
      });

      if (!entry || entry.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Song request not found.",
        });
      }

      await prisma.songRequest.delete({ where: { id: input.id } });

      await prisma.$executeRawUnsafe(
        `UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = $1 AND position > $2`,
        botChannel.id,
        entry.position
      );

      const { eventBus } = await import("../events");
      await eventBus.publish("song-request:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "song-request.remove",
        resourceType: "SongRequest",
        resourceId: input.id,
        metadata: { title: entry.title },
      });

      return { success: true };
    }),

  clear: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    await prisma.songRequest.deleteMany({
      where: { botChannelId: botChannel.id },
    });

    const { eventBus } = await import("../events");
    await eventBus.publish("song-request:updated", { channelId: botChannel.id });

    await logAudit({
      userId: ctx.session.user.id,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "song-request.clear",
      resourceType: "SongRequest",
      resourceId: botChannel.id,
    });

    return { success: true };
  }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const settings = await prisma.songRequestSettings.findUnique({
      where: { botChannelId: botChannel.id },
    });

    return (
      settings ?? {
        id: null,
        botChannelId: botChannel.id,
        enabled: false,
        maxQueueSize: 50,
        maxPerUser: 5,
        minAccessLevel: "EVERYONE",
        maxDuration: null,
        autoPlayEnabled: false,
        activePlaylistId: null,
      }
    );
  }),

  updateSettings: moderatorProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        maxQueueSize: z.number().int().min(1).max(500).optional(),
        maxPerUser: z.number().int().min(1).max(100).optional(),
        minAccessLevel: z
          .enum([
            "EVERYONE",
            "SUBSCRIBER",
            "REGULAR",
            "VIP",
            "MODERATOR",
            "LEAD_MODERATOR",
            "BROADCASTER",
          ])
          .optional(),
        maxDuration: z.number().int().min(1).max(36000).nullable().optional(),
        autoPlayEnabled: z.boolean().optional(),
        activePlaylistId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const settings = await prisma.songRequestSettings.upsert({
        where: { botChannelId: botChannel.id },
        update: input,
        create: {
          botChannelId: botChannel.id,
          ...input,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("song-request:settings-updated", {
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "song-request.settings-update",
        resourceType: "SongRequestSettings",
        resourceId: settings.id,
        metadata: input,
      });

      return settings;
    }),
});
