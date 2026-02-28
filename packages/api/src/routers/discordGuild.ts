import { prisma } from "@community-bot/db";
import { protectedProcedure, leadModProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import {
  discordFetch,
  type DiscordChannel,
  type DiscordRole,
} from "../utils/discord";

function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=64`;
}

export const discordGuildRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
    });

    return guild
      ? {
          id: guild.id,
          guildId: guild.guildId,
          name: guild.name,
          icon: guildIconUrl(guild.guildId, guild.icon),
          enabled: guild.enabled,
          notificationChannelId: guild.notificationChannelId,
          notificationRoleId: guild.notificationRoleId,
          adminRoleId: guild.adminRoleId,
          modRoleId: guild.modRoleId,
          joinedAt: guild.joinedAt.toISOString(),
        }
      : null;
  }),

  listAvailableGuilds: protectedProcedure.query(async () => {
    const guilds = await prisma.discordGuild.findMany({
      where: { userId: null },
      orderBy: { joinedAt: "desc" },
    });

    return guilds.map((g) => ({
      guildId: g.guildId,
      name: g.name,
      icon: guildIconUrl(g.guildId, g.icon),
    }));
  }),

  getGuildChannels: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
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

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
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

      const guild = await prisma.discordGuild.findUnique({
        where: { guildId: input.guildId },
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

      const updated = await prisma.discordGuild.update({
        where: { id: guild.id },
        data: { userId },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:settings-updated", {
        guildId: input.guildId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.link",
        resourceType: "DiscordGuild",
        resourceId: updated.id,
        metadata: { guildId: input.guildId },
      });

      return {
        id: updated.id,
        guildId: updated.guildId,
        name: updated.name,
        icon: guildIconUrl(updated.guildId, updated.icon),
        enabled: updated.enabled,
        notificationChannelId: updated.notificationChannelId,
        notificationRoleId: updated.notificationRoleId,
        adminRoleId: updated.adminRoleId,
        modRoleId: updated.modRoleId,
        joinedAt: updated.joinedAt.toISOString(),
      };
    }),

  setNotificationChannel: leadModProcedure
    .input(z.object({ channelId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await prisma.discordGuild.findFirst({
        where: { userId },
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const before = guild.notificationChannelId;

      await prisma.discordGuild.update({
        where: { id: guild.id },
        data: { notificationChannelId: input.channelId },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:settings-updated", {
        guildId: guild.guildId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.set-channel",
        resourceType: "DiscordGuild",
        resourceId: guild.id,
        metadata: { before, after: input.channelId },
      });

      return { success: true };
    }),

  setNotificationRole: leadModProcedure
    .input(z.object({ roleId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await prisma.discordGuild.findFirst({
        where: { userId },
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const before = guild.notificationRoleId;

      await prisma.discordGuild.update({
        where: { id: guild.id },
        data: { notificationRoleId: input.roleId },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:settings-updated", {
        guildId: guild.guildId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.set-role",
        resourceType: "DiscordGuild",
        resourceId: guild.id,
        metadata: { before, after: input.roleId },
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

      const guild = await prisma.discordGuild.findFirst({
        where: { userId },
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

      await prisma.discordGuild.update({
        where: { id: guild.id },
        data: {
          adminRoleId: input.adminRoleId,
          modRoleId: input.modRoleId,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:settings-updated", {
        guildId: guild.guildId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.set-role-mapping",
        resourceType: "DiscordGuild",
        resourceId: guild.id,
        metadata: { before, after: input },
      });

      return { success: true };
    }),

  enable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    await prisma.discordGuild.update({
      where: { id: guild.id },
      data: { enabled: true },
    });

    const { eventBus } = await import("../events");
    await eventBus.publish("discord:settings-updated", {
      guildId: guild.guildId,
    });

    await logAudit({
      userId,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "discord.enable",
      resourceType: "DiscordGuild",
      resourceId: guild.id,
    });

    return { success: true };
  }),

  disable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    await prisma.discordGuild.update({
      where: { id: guild.id },
      data: { enabled: false },
    });

    const { eventBus } = await import("../events");
    await eventBus.publish("discord:settings-updated", {
      guildId: guild.guildId,
    });

    await logAudit({
      userId,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "discord.disable",
      resourceType: "DiscordGuild",
      resourceId: guild.id,
    });

    return { success: true };
  }),

  listMonitoredChannels: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    const channels = await prisma.twitchChannel.findMany({
      where: { guildId: guild.id },
      orderBy: { joinedAt: "asc" },
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

      const guild = await prisma.discordGuild.findFirst({
        where: { userId },
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const channel = await prisma.twitchChannel.findFirst({
        where: { id: input.channelId, guildId: guild.id },
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

      await prisma.twitchChannel.update({
        where: { id: channel.id },
        data,
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:settings-updated", {
        guildId: guild.guildId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.channel-settings",
        resourceType: "TwitchChannel",
        resourceId: channel.id,
        metadata: { channelName: channel.displayName ?? channel.username, ...data },
      });

      return { success: true };
    }),

  getWelcomeSettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
    });

    if (!guild) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Discord server linked.",
      });
    }

    return {
      welcomeEnabled: guild.welcomeEnabled,
      welcomeChannelId: guild.welcomeChannelId,
      welcomeMessage: guild.welcomeMessage,
      welcomeUseEmbed: guild.welcomeUseEmbed,
      welcomeEmbedJson: guild.welcomeEmbedJson,
      leaveEnabled: guild.leaveEnabled,
      leaveChannelId: guild.leaveChannelId,
      leaveMessage: guild.leaveMessage,
      leaveUseEmbed: guild.leaveUseEmbed,
      leaveEmbedJson: guild.leaveEmbedJson,
      autoRoleEnabled: guild.autoRoleEnabled,
      autoRoleId: guild.autoRoleId,
      dmWelcomeEnabled: guild.dmWelcomeEnabled,
      dmWelcomeMessage: guild.dmWelcomeMessage,
      dmWelcomeUseEmbed: guild.dmWelcomeUseEmbed,
      dmWelcomeEmbedJson: guild.dmWelcomeEmbedJson,
    };
  }),

  updateWelcomeSettings: leadModProcedure
    .input(
      z.object({
        welcomeEnabled: z.boolean().optional(),
        welcomeChannelId: z.string().nullable().optional(),
        welcomeMessage: z.string().nullable().optional(),
        welcomeUseEmbed: z.boolean().optional(),
        welcomeEmbedJson: z.string().nullable().optional(),
        leaveEnabled: z.boolean().optional(),
        leaveChannelId: z.string().nullable().optional(),
        leaveMessage: z.string().nullable().optional(),
        leaveUseEmbed: z.boolean().optional(),
        leaveEmbedJson: z.string().nullable().optional(),
        autoRoleEnabled: z.boolean().optional(),
        autoRoleId: z.string().nullable().optional(),
        dmWelcomeEnabled: z.boolean().optional(),
        dmWelcomeMessage: z.string().nullable().optional(),
        dmWelcomeUseEmbed: z.boolean().optional(),
        dmWelcomeEmbedJson: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await prisma.discordGuild.findFirst({
        where: { userId },
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          data[key] = value;
        }
      }

      await prisma.discordGuild.update({
        where: { id: guild.id },
        data,
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:settings-updated", {
        guildId: guild.guildId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.welcome-settings",
        resourceType: "DiscordGuild",
        resourceId: guild.id,
        metadata: data,
      });

      return { success: true };
    }),

  testWelcomeMessage: leadModProcedure
    .input(z.object({ type: z.enum(["welcome", "leave", "dm"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const guild = await prisma.discordGuild.findFirst({
        where: { userId },
      });

      if (!guild) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Discord server linked.",
        });
      }

      const { eventBus } = await import("../events");
      await eventBus.publish("discord:test-welcome", {
        guildId: guild.guildId,
        type: input.type,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.test-welcome",
        resourceType: "DiscordGuild",
        resourceId: guild.id,
        metadata: { type: input.type },
      });

      return { success: true };
    }),

  testNotification: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const guild = await prisma.discordGuild.findFirst({
      where: { userId },
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
    await eventBus.publish("discord:test-notification", {
      guildId: guild.guildId,
    });

    return { success: true };
  }),
});
