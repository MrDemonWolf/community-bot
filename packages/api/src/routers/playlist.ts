import { db, eq, and, desc, count, sql, playlists, playlistEntries, songRequestSettings } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

export const playlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const playlistList = await db.query.playlists.findMany({
      where: eq(playlists.botChannelId, botChannel.id),
      orderBy: desc(playlists.createdAt),
    });

    // Get entry counts
    const playlistsWithCounts = await Promise.all(
      playlistList.map(async (p) => {
        const entryResult = await db.select({ value: count() }).from(playlistEntries).where(eq(playlistEntries.playlistId, p.id));
        const entryCount = entryResult[0]?.value ?? 0;
        return {
          id: p.id,
          name: p.name,
          entryCount,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      })
    );

    // Also get active playlist ID from settings
    const settings = await db.query.songRequestSettings.findFirst({
      where: eq(songRequestSettings.botChannelId, botChannel.id),
    });

    return {
      playlists: playlistsWithCounts,
      activePlaylistId: settings?.activePlaylistId ?? null,
    };
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const playlist = await db.query.playlists.findFirst({
        where: eq(playlists.id, input.id),
        with: {
          entries: true,
        },
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Sort entries by position ascending
      playlist.entries.sort((a, b) => a.position - b.position);

      return playlist;
    }),

  create: moderatorProcedure
    .input(z.object({ name: z.string().min(1).max(100).trim() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const existing = await db.query.playlists.findFirst({
        where: and(eq(playlists.name, input.name), eq(playlists.botChannelId, botChannel.id)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A playlist named "${input.name}" already exists.`,
        });
      }

      const [playlist] = await db.insert(playlists).values({
        name: input.name,
        botChannelId: botChannel.id,
      }).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("playlist:created", {
        playlistId: playlist!.id,
        channelId: botChannel.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "playlist.create",
        resourceType: "Playlist",
        resourceId: playlist!.id,
        metadata: { name: input.name },
      });

      return playlist!;
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

      const playlist = await db.query.playlists.findFirst({
        where: eq(playlists.id, input.id),
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Check name uniqueness
      const existing = await db.query.playlists.findFirst({
        where: and(eq(playlists.name, input.name), eq(playlists.botChannelId, botChannel.id)),
      });

      if (existing && existing.id !== input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A playlist named "${input.name}" already exists.`,
        });
      }

      const [updated] = await db.update(playlists).set({ name: input.name }).where(eq(playlists.id, input.id)).returning();

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

      const playlist = await db.query.playlists.findFirst({
        where: eq(playlists.id, input.id),
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Clear activePlaylistId if this playlist is active
      const settings = await db.query.songRequestSettings.findFirst({
        where: eq(songRequestSettings.botChannelId, botChannel.id),
      });
      if (settings?.activePlaylistId === input.id) {
        await db.update(songRequestSettings).set({ activePlaylistId: null }).where(eq(songRequestSettings.botChannelId, botChannel.id));
      }

      await db.delete(playlists).where(eq(playlists.id, input.id));

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

      const playlist = await db.query.playlists.findFirst({
        where: eq(playlists.id, input.playlistId),
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Get next position
      const last = await db.query.playlistEntries.findFirst({
        where: eq(playlistEntries.playlistId, input.playlistId),
        orderBy: desc(playlistEntries.position),
      });
      const position = (last?.position ?? 0) + 1;

      const [entry] = await db.insert(playlistEntries).values({
        position,
        title: input.title,
        youtubeVideoId: input.youtubeVideoId ?? null,
        youtubeDuration: input.youtubeDuration ?? null,
        youtubeThumbnail: input.youtubeThumbnail ?? null,
        youtubeChannel: input.youtubeChannel ?? null,
        playlistId: input.playlistId,
      }).returning();

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
        resourceId: entry!.id,
        metadata: { title: input.title, playlistName: playlist.name },
      });

      return entry!;
    }),

  removeEntry: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const entry = await db.query.playlistEntries.findFirst({
        where: eq(playlistEntries.id, input.id),
        with: { playlist: true },
      });

      if (!entry || entry.playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist entry not found.",
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(playlistEntries).where(eq(playlistEntries.id, input.id));
        await tx.execute(
          sql`UPDATE "PlaylistEntry" SET position = position - 1 WHERE "playlistId" = ${entry.playlistId} AND position > ${entry.position}`
        );
      });

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

      const playlist = await db.query.playlists.findFirst({
        where: eq(playlists.id, input.playlistId),
      });

      if (!playlist || playlist.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      // Update positions in a transaction
      await db.transaction(async (tx) => {
        for (let i = 0; i < input.entryIds.length; i++) {
          await tx.update(playlistEntries).set({ position: i + 1 }).where(eq(playlistEntries.id, input.entryIds[i]!));
        }
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
        const playlist = await db.query.playlists.findFirst({
          where: eq(playlists.id, input.playlistId),
        });
        if (!playlist || playlist.botChannelId !== botChannel.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Playlist not found.",
          });
        }
      }

      await db.insert(songRequestSettings).values({
        botChannelId: botChannel.id,
        activePlaylistId: input.playlistId,
      }).onConflictDoUpdate({
        target: songRequestSettings.botChannelId,
        set: { activePlaylistId: input.playlistId },
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
