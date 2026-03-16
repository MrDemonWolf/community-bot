import { db, eq, and, asc, sql, systemConfigs, botChannels, songRequests, songRequestSettings } from "@community-bot/db";
import { publicProcedure, protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

async function getBroadcasterBotChannelId(): Promise<string | null> {
  const config = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "broadcasterUserId"),
  });
  if (!config) return null;

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, config.value),
  });

  return botChannel?.id ?? null;
}

export const songRequestRouter = router({
  publicCurrent: publicProcedure.query(async () => {
    const botChannelId = await getBroadcasterBotChannelId();
    if (!botChannelId) return null;

    const song = await db.query.songRequests.findFirst({
      where: and(eq(songRequests.botChannelId, botChannelId), eq(songRequests.position, 1)),
    });

    if (!song) return null;

    return {
      id: song.id,
      title: song.title,
      requestedBy: song.requestedBy,
      youtubeVideoId: song.youtubeVideoId,
      youtubeThumbnail: song.youtubeThumbnail,
      youtubeDuration: song.youtubeDuration,
      source: song.source,
    };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.songRequests.findMany({
      where: eq(songRequests.botChannelId, botChannel.id),
      orderBy: asc(songRequests.position),
    });
  }),

  current: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.songRequests.findFirst({
      where: and(eq(songRequests.botChannelId, botChannel.id), eq(songRequests.position, 1)),
    });
  }),

  skip: moderatorProcedure.mutation(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const entry = await db.query.songRequests.findFirst({
      where: and(eq(songRequests.botChannelId, botChannel.id), eq(songRequests.position, 1)),
    });

    if (!entry) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No song request to skip.",
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(songRequests).where(eq(songRequests.id, entry.id));
      await tx.execute(
        sql`UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = ${botChannel.id} AND position > 1`
      );
    });

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

      const entry = await db.query.songRequests.findFirst({
        where: eq(songRequests.id, input.id),
      });

      if (!entry || entry.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Song request not found.",
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(songRequests).where(eq(songRequests.id, input.id));
        await tx.execute(
          sql`UPDATE "SongRequest" SET position = position - 1 WHERE "botChannelId" = ${botChannel.id} AND position > ${entry.position}`
        );
      });

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

    await db.delete(songRequests).where(eq(songRequests.botChannelId, botChannel.id));

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

    const settings = await db.query.songRequestSettings.findFirst({
      where: eq(songRequestSettings.botChannelId, botChannel.id),
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

      const [settings] = await db.insert(songRequestSettings).values({
        botChannelId: botChannel.id,
        ...input,
      }).onConflictDoUpdate({
        target: songRequestSettings.botChannelId,
        set: input,
      }).returning();

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
        resourceId: settings!.id,
        metadata: input,
      });

      return settings;
    }),
});
