import { prisma } from "@community-bot/db";
import { protectedProcedure, router } from "../index";
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

  linkGuild: protectedProcedure
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
        joinedAt: updated.joinedAt.toISOString(),
      };
    }),

  setNotificationChannel: protectedProcedure
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

  setNotificationRole: protectedProcedure
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

  enable: protectedProcedure.mutation(async ({ ctx }) => {
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

  disable: protectedProcedure.mutation(async ({ ctx }) => {
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

  testNotification: protectedProcedure.mutation(async ({ ctx }) => {
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
