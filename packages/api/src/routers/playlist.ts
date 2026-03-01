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

export const playlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const playlists = await prisma.playlist.findMany({
      where: { botChannelId: botChannel.id },
      include: { _count: { select: { entries: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Also get active playlist ID from settings
    const settings = await prisma.songRequestSettings.findUnique({
      where: { botChannelId: botChannel.id },
      select: { activePlaylistId: true },
    });

    return {
      playlists: playlists.map((p) => ({
        id: p.id,
        name: p.name,
        entryCount: p._count.entries,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      activePlaylistId: settings?.activePlaylistId ?? null,
    };
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const playlist = await prisma.playlist.findUnique({
        where: { id: input.id },
        include: {
          entries: { orderBy: { position: "asc" } },
        },
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      return playlist;
    }),

  create: moderatorProcedure
    .input(z.object({ name: z.string().min(1).max(100).trim() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const existing = await prisma.playlist.findUnique({
        where: {
          name_botChannelId: {
            name: input.name,
            botChannelId: botChannel.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A playlist named "${input.name}" already exists.`,
        });
      }

      const playlist = await prisma.playlist.create({
        data: {
          name: input.name,
          botChannelId: botChannel.id,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:created", {
        playlistId: playlist.id,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.create",
        resourceType: "Playlist",
        resourceId: playlist.id,
        metadata: { name: input.name },
      });

      return playlist;
    }),

  rename: moderatorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).trim(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const playlist = await prisma.playlist.findUnique({
        where: { id: input.id },
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Check name uniqueness
      const existing = await prisma.playlist.findUnique({
        where: {
          name_botChannelId: {
            name: input.name,
            botChannelId: botChannel.id,
          },
        },
      });

      if (existing && existing.id !== input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A playlist named "${input.name}" already exists.`,
        });
      }

      const updated = await prisma.playlist.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:updated", {
        playlistId: input.id,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.update",
        resourceType: "Playlist",
        resourceId: input.id,
        metadata: { oldName: playlist.name, newName: input.name },
      });

      return updated;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const playlist = await prisma.playlist.findUnique({
        where: { id: input.id },
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Clear activePlaylistId if this playlist is active
      const settings = await prisma.songRequestSettings.findUnique({
        where: { botChannelId: botChannel.id },
      });
      if (settings?.activePlaylistId === input.id) {
        await prisma.songRequestSettings.update({
          where: { botChannelId: botChannel.id },
          data: { activePlaylistId: null },
        });
      }

      await prisma.playlist.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:deleted", {
        playlistId: input.id,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.delete",
        resourceType: "Playlist",
        resourceId: input.id,
        metadata: { name: playlist.name },
      });

      return { success: true };
    }),

  addEntry: moderatorProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        title: z.string().min(1).max(500),
        youtubeVideoId: z.string().optional(),
        youtubeDuration: z.number().int().optional(),
        youtubeThumbnail: z.string().optional(),
        youtubeChannel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const playlist = await prisma.playlist.findUnique({
        where: { id: input.playlistId },
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Get next position
      const last = await prisma.playlistEntry.findFirst({
        where: { playlistId: input.playlistId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (last?.position ?? 0) + 1;

      const entry = await prisma.playlistEntry.create({
        data: {
          position,
          title: input.title,
          youtubeVideoId: input.youtubeVideoId ?? null,
          youtubeDuration: input.youtubeDuration ?? null,
          youtubeThumbnail: input.youtubeThumbnail ?? null,
          youtubeChannel: input.youtubeChannel ?? null,
          playlistId: input.playlistId,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:updated", {
        playlistId: input.playlistId,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.add-entry",
        resourceType: "PlaylistEntry",
        resourceId: entry.id,
        metadata: { title: input.title, playlistName: playlist.name },
      });

      return entry;
    }),

  removeEntry: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const entry = await prisma.playlistEntry.findUnique({
        where: { id: input.id },
        include: { playlist: true },
      });

      if (!entry || entry.playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist entry not found.",
        });
      }

      await prisma.playlistEntry.delete({ where: { id: input.id } });

      // Reorder positions
      await prisma.$executeRawUnsafe(
        `UPDATE "PlaylistEntry" SET position = position - 1 WHERE "playlistId" = $1 AND position > $2`,
        entry.playlistId,
        entry.position
      );

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:updated", {
        playlistId: entry.playlistId,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.remove-entry",
        resourceType: "PlaylistEntry",
        resourceId: input.id,
        metadata: { title: entry.title },
      });

      return { success: true };
    }),

  reorderEntries: moderatorProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        entryIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const playlist = await prisma.playlist.findUnique({
        where: { id: input.playlistId },
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Update positions in a transaction
      await prisma.$transaction(
        input.entryIds.map((id, index) =>
          prisma.playlistEntry.update({
            where: { id },
            data: { position: index + 1 },
          })
        )
      );

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:updated", {
        playlistId: input.playlistId,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.reorder",
        resourceType: "Playlist",
        resourceId: input.playlistId,
        metadata: { name: playlist.name },
      });

      return { success: true };
    }),

  setActive: moderatorProcedure
    .input(
      z.object({
        playlistId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      if (input.playlistId) {
        const playlist = await prisma.playlist.findUnique({
          where: { id: input.playlistId },
        });
        if (!playlist || playlist.botChannelId !== botChannel.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Playlist not found.",
          });
        }
      }

      await prisma.songRequestSettings.upsert({
        where: { botChannelId: botChannel.id },
        update: { activePlaylistId: input.playlistId },
        create: {
          botChannelId: botChannel.id,
          activePlaylistId: input.playlistId,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:activated", {
        playlistId: input.playlistId,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.activate",
        resourceType: "Playlist",
        resourceId: input.playlistId ?? "none",
        metadata: { active: !!input.playlistId },
      });

      return { success: true };
    }),
});
