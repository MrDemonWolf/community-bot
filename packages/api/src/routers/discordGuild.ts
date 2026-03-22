import { db, eq, and, asc, desc, isNull, discordGuilds, twitchChannels, twitchNotifications, discordLogConfigs } from "@community-bot/db";
import { protectedProcedure, leadModProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";
import {
  discordFetch,
  type DiscordChannel,
  type DiscordRole,
} from "../utils/discord";
import { getTwitchUserByLogin } from "../utils/twitch";

function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=64`;
}

export const discordGuildRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    return guild
      ? {
          id: guild.id,
          guildId: guild.guildId,
          name: guild.name,
          icon: guildIconUrl(guild.guildId, guild.icon),
          enabled: guild.enabled,
          muted: guild.muted,
          notificationChannelId: guild.notificationChannelId,
          notificationRoleId: guild.notificationRoleId,
          adminRoleId: guild.adminRoleId,
          modRoleId: guild.modRoleId,
          joinedAt: guild.joinedAt.toISOString(),
        }
      : null;
  }),

  listAvailableGuilds: protectedProcedure.query(async () => {
    const guilds = await db.query.discordGuilds.findMany({
      where: isNull(discordGuilds.userId),
      orderBy: desc(discordGuilds.joinedAt),
    });

    return guilds.map((g) => ({
      guildId: g.guildId,
      name: g.name,
      icon: guildIconUrl(g.guildId, g.icon),
    }));
  }),

  getGuildChannels: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    const channels = await discordFetch<DiscordChannel[]>(
      `/guilds/${guild.guildId}/channels`
    );

    // Filter to text channels (0) and announcement channels (5)
    return channels
      .filter((c) => c.type === 0 || c.type === 5)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, type: c.type }));
  }),

  getGuildRoles: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    const roles = await discordFetch<DiscordRole[]>(
      `/guilds/${guild.guildId}/roles`
    );

    // Filter out managed (bot) roles and @everyone (position 0, name @everyone)
    return roles
      .filter((r) => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color }));
  }),

  linkGuild: leadModProcedure
    .input(z.object({ guildId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.guildId, input.guildId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Discord server not found. Make sure the bot has been added to your server first.",
        });
      }

      if (guild.userId && guild.userId !== userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This Discord server is already linked to another account.",
        });
      }

      const [updated] = await db.update(discordGuilds).set({ userId }).where(eq(discordGuilds.id, guild.id)).returning();

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: input.guildId } },
        audit: { action: "discord.link", resourceType: "DiscordGuild", resourceId: updated!.id, metadata: { guildId: input.guildId } },
      });

      return {
        id: updated!.id,
        guildId: updated!.guildId,
        name: updated!.name,
        icon: guildIconUrl(updated!.guildId, updated!.icon),
        enabled: updated!.enabled,
        notificationChannelId: updated!.notificationChannelId,
        notificationRoleId: updated!.notificationRoleId,
        adminRoleId: updated!.adminRoleId,
        modRoleId: updated!.modRoleId,
        joinedAt: updated!.joinedAt.toISOString(),
      };
    }),

  setNotificationChannel: leadModProcedure
    .input(z.object({ channelId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const before = guild.notificationChannelId;

      await db.update(discordGuilds).set({ notificationChannelId: input.channelId }).where(eq(discordGuilds.id, guild.id));

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.set-channel", resourceType: "DiscordGuild", resourceId: guild.id, metadata: { before, after: input.channelId } },
      });

      return { success: true };
    }),

  setNotificationRole: leadModProcedure
    .input(z.object({ roleId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const before = guild.notificationRoleId;

      await db.update(discordGuilds).set({ notificationRoleId: input.roleId }).where(eq(discordGuilds.id, guild.id));

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.set-role", resourceType: "DiscordGuild", resourceId: guild.id, metadata: { before, after: input.roleId } },
      });

      return { success: true };
    }),

  setRoleMapping: leadModProcedure
    .input(
      z.object({
        adminRoleId: z.string().nullable(),
        modRoleId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const before = {
        adminRoleId: guild.adminRoleId,
        modRoleId: guild.modRoleId,
      };

      await db.update(discordGuilds).set({
        adminRoleId: input.adminRoleId,
        modRoleId: input.modRoleId,
      }).where(eq(discordGuilds.id, guild.id));

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.set-role-mapping", resourceType: "DiscordGuild", resourceId: guild.id, metadata: { before, after: input } },
      });

      return { success: true };
    }),

  enable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    await db.update(discordGuilds).set({ enabled: true }).where(eq(discordGuilds.id, guild.id));

    await applyMutationEffects(ctx, {
      event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
      audit: { action: "discord.enable", resourceType: "DiscordGuild", resourceId: guild.id },
    });

    return { success: true };
  }),

  disable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    await db.update(discordGuilds).set({ enabled: false }).where(eq(discordGuilds.id, guild.id));

    await applyMutationEffects(ctx, {
      event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
      audit: { action: "discord.disable", resourceType: "DiscordGuild", resourceId: guild.id },
    });

    return { success: true };
  }),

  listMonitoredChannels: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    const channels = await db.query.twitchChannels.findMany({
      where: eq(twitchChannels.guildId, guild.id),
      orderBy: asc(twitchChannels.joinedAt),
    });

    return channels.map((ch) => ({
      id: ch.id,
      twitchChannelId: ch.twitchChannelId,
      username: ch.username,
      displayName: ch.displayName,
      profileImageUrl: ch.profileImageUrl,
      isLive: ch.isLive,
      notificationChannelId: ch.notificationChannelId,
      notificationRoleId: ch.notificationRoleId,
      updateMessageLive: ch.updateMessageLive,
      deleteWhenOffline: ch.deleteWhenOffline,
      autoPublish: ch.autoPublish,
      useCustomMessage: ch.useCustomMessage,
      customOnlineMessage: ch.customOnlineMessage,
      customOfflineMessage: ch.customOfflineMessage,
    }));
  }),

  updateChannelSettings: leadModProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        notificationChannelId: z.string().nullable().optional(),
        notificationRoleId: z.string().nullable().optional(),
        updateMessageLive: z.boolean().optional(),
        deleteWhenOffline: z.boolean().optional(),
        autoPublish: z.boolean().optional(),
        useCustomMessage: z.boolean().optional(),
        customOnlineMessage: z.string().nullable().optional(),
        customOfflineMessage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const channel = await db.query.twitchChannels.findFirst({
        where: and(eq(twitchChannels.id, input.channelId), eq(twitchChannels.guildId, guild.id)),
      });

      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitored channel not found.",
        });
      }

      const { channelId: _, ...updateData } = input;

      // Remove undefined keys so we only update provided fields
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          data[key] = value;
        }
      }

      await db.update(twitchChannels).set(data).where(eq(twitchChannels.id, channel.id));

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.channel-settings", resourceType: "TwitchChannel", resourceId: channel.id, metadata: { channelName: channel.displayName ?? channel.username, ...data } },
      });

      return { success: true };
    }),

  addMonitoredChannel: leadModProcedure
    .input(z.object({ username: z.string().min(1).max(25) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      let twitchUser;
      try {
        twitchUser = await getTwitchUserByLogin(input.username.toLowerCase());
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to look up Twitch user. Please try again.",
        });
      }

      if (!twitchUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Twitch user not found.",
        });
      }

      const existing = await db.query.twitchChannels.findFirst({
        where: and(
          eq(twitchChannels.twitchChannelId, twitchUser.id),
          eq(twitchChannels.guildId, guild.id),
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${twitchUser.display_name} is already being monitored.`,
        });
      }

      const [channel] = await db.insert(twitchChannels).values({
        twitchChannelId: twitchUser.id,
        username: twitchUser.login,
        displayName: twitchUser.display_name,
        profileImageUrl: twitchUser.profile_image_url,
        guildId: guild.id,
      }).returning();

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.add-channel", resourceType: "TwitchChannel", resourceId: channel!.id, metadata: { channelName: twitchUser.display_name } },
      });

      return { id: channel!.id, displayName: twitchUser.display_name };
    }),

  removeMonitoredChannel: leadModProcedure
    .input(z.object({ channelId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const channel = await db.query.twitchChannels.findFirst({
        where: and(eq(twitchChannels.id, input.channelId), eq(twitchChannels.guildId, guild.id)),
      });

      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitored channel not found.",
        });
      }

      await db.delete(twitchNotifications).where(eq(twitchNotifications.twitchChannelId, channel.id));

      await db.delete(twitchChannels).where(eq(twitchChannels.id, channel.id));

      await applyMutationEffects(ctx, {
        event: { name: "discord:settings-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.remove-channel", resourceType: "TwitchChannel", resourceId: channel.id, metadata: { channelName: channel.displayName ?? channel.username } },
      });

      return { success: true };
    }),

  mute: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    await db.update(discordGuilds).set({ muted: true }).where(eq(discordGuilds.id, guild.id));

    await applyMutationEffects(ctx, {
      event: { name: "discord:mute", payload: { guildId: guild.guildId, muted: true } },
      audit: { action: "discord.mute", resourceType: "DiscordGuild", resourceId: guild.id },
    });

    return { success: true };
  }),

  unmute: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    await db.update(discordGuilds).set({ muted: false }).where(eq(discordGuilds.id, guild.id));

    await applyMutationEffects(ctx, {
      event: { name: "discord:mute", payload: { guildId: guild.guildId, muted: false } },
      audit: { action: "discord.unmute", resourceType: "DiscordGuild", resourceId: guild.id },
    });

    return { success: true };
  }),

  getLogConfig: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    const config = await db.query.discordLogConfigs.findFirst({
      where: eq(discordLogConfigs.guildId, guild.guildId),
    });

    return {
      moderationChannelId: config?.moderationChannelId ?? null,
      serverChannelId: config?.serverChannelId ?? null,
      voiceChannelId: config?.voiceChannelId ?? null,
    };
  }),

  setLogConfig: leadModProcedure
    .input(
      z.object({
        moderationChannelId: z.string().nullable(),
        serverChannelId: z.string().nullable(),
        voiceChannelId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      await db.insert(discordLogConfigs).values({
        guildId: guild.guildId,
        moderationChannelId: input.moderationChannelId,
        serverChannelId: input.serverChannelId,
        voiceChannelId: input.voiceChannelId,
      }).onConflictDoUpdate({
        target: discordLogConfigs.guildId,
        set: {
          moderationChannelId: input.moderationChannelId,
          serverChannelId: input.serverChannelId,
          voiceChannelId: input.voiceChannelId,
        },
      });

      await applyMutationEffects(ctx, {
        event: { name: "discord:log-config-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.set-log-config", resourceType: "DiscordLogConfig", resourceId: guild.guildId, metadata: input },
      });

      return { success: true };
    }),

  getPresence: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    return {
      activityText: guild.activityText ?? null,
      activityType: guild.activityType ?? "CUSTOM",
      activityUrl: guild.activityUrl ?? null,
    };
  }),

  setPresence: leadModProcedure
    .input(
      z.object({
        activityText: z.string().max(128).nullable(),
        activityType: z.enum(["PLAYING", "STREAMING", "LISTENING", "WATCHING", "COMPETING", "CUSTOM"]).default("CUSTOM"),
        activityUrl: z.string().url().nullable().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.userId, userId),
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const before = {
        activityText: guild.activityText,
        activityType: guild.activityType,
        activityUrl: guild.activityUrl,
      };

      await db.update(discordGuilds).set({
        activityText: input.activityText,
        activityType: input.activityType,
        activityUrl: input.activityUrl || null,
      }).where(eq(discordGuilds.id, guild.id));

      await applyMutationEffects(ctx, {
        event: { name: "discord:presence-updated", payload: { guildId: guild.guildId } },
        audit: { action: "discord.set-presence", resourceType: "DiscordGuild", resourceId: guild.id, metadata: { before, after: input } },
      });

      return { success: true };
    }),

  testNotification: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await db.query.discordGuilds.findFirst({
      where: eq(discordGuilds.userId, userId),
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    if (!guild.notificationChannelId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Set a notification channel first.",
      });
    }

    const { eventBus } = await import("../events");
    await eventBus.publish("discord:test-notification", { guildId: guild.guildId });

    return { success: true };
  }),
});
