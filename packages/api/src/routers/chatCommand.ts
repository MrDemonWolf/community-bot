import { prisma } from "@community-bot/db";
import { protectedProcedure, router } from "../index";
import { z } from "zod";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

const DEFAULT_COMMAND_NAMES = new Set(DEFAULT_COMMANDS.map((c) => c.name));

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

export const chatCommandRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const commands = await prisma.twitchChatCommand.findMany({
      where: { botChannelId: botChannel.id },
      orderBy: { name: "asc" },
    });

    return commands;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9_]+$/, "Name must be alphanumeric or underscore"),
        response: z.string().min(1).max(500),
        responseType: z.enum(["SAY", "MENTION", "REPLY"]).default("SAY"),
        accessLevel: z
          .enum([
            "EVERYONE",
            "SUBSCRIBER",
            "REGULAR",
            "VIP",
            "MODERATOR",
            "LEAD_MODERATOR",
            "BROADCASTER",
          ])
          .default("EVERYONE"),
        globalCooldown: z.number().int().min(0).max(3600).default(0),
        userCooldown: z.number().int().min(0).max(3600).default(0),
        streamStatus: z.enum(["ONLINE", "OFFLINE", "BOTH"]).default("BOTH"),
        aliases: z.array(z.string().max(50)).max(10).default([]),
        hidden: z.boolean().default(false),
        expiresAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const name = input.name.toLowerCase();

      if (DEFAULT_COMMAND_NAMES.has(name)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${name}" is a built-in command and cannot be used.`,
        });
      }

      // Check for conflicts with existing commands in this channel
      const existing = await prisma.twitchChatCommand.findUnique({
        where: { name_botChannelId: { name, botChannelId: botChannel.id } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Command "!${name}" already exists.`,
        });
      }

      const command = await prisma.twitchChatCommand.create({
        data: {
          name,
          response: input.response,
          responseType: input.responseType,
          accessLevel: input.accessLevel,
          globalCooldown: input.globalCooldown,
          userCooldown: input.userCooldown,
          streamStatus: input.streamStatus,
          aliases: input.aliases.map((a) => a.toLowerCase()),
          hidden: input.hidden,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          botChannelId: botChannel.id,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("command:created", { commandId: command.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.create",
        resourceType: "TwitchChatCommand",
        resourceId: command.id,
        metadata: { name },
      });

      return command;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9_]+$/, "Name must be alphanumeric or underscore")
          .optional(),
        response: z.string().min(1).max(500).optional(),
        responseType: z.enum(["SAY", "MENTION", "REPLY"]).optional(),
        accessLevel: z
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
        globalCooldown: z.number().int().min(0).max(3600).optional(),
        userCooldown: z.number().int().min(0).max(3600).optional(),
        streamStatus: z.enum(["ONLINE", "OFFLINE", "BOTH"]).optional(),
        aliases: z.array(z.string().max(50)).max(10).optional(),
        hidden: z.boolean().optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const command = await prisma.twitchChatCommand.findUnique({
        where: { id: input.id },
      });

      if (!command || command.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      const { id, expiresAt, aliases, name, ...rest } = input;

      const command_updated = await prisma.twitchChatCommand.update({
        where: { id },
        data: {
          ...rest,
          ...(name !== undefined ? { name: name.toLowerCase() } : {}),
          ...(aliases !== undefined
            ? { aliases: aliases.map((a) => a.toLowerCase()) }
            : {}),
          ...(expiresAt !== undefined
            ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
            : {}),
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("command:updated", { commandId: id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.update",
        resourceType: "TwitchChatCommand",
        resourceId: id,
        metadata: { name: command_updated.name },
      });

      return command_updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const command = await prisma.twitchChatCommand.findUnique({
        where: { id: input.id },
      });

      if (!command || command.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      await prisma.twitchChatCommand.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("command:deleted", { commandId: input.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.delete",
        resourceType: "TwitchChatCommand",
        resourceId: input.id,
        metadata: { name: command.name },
      });

      return { success: true };
    }),

  toggleEnabled: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const command = await prisma.twitchChatCommand.findUnique({
        where: { id: input.id },
      });

      if (!command || command.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      const updated = await prisma.twitchChatCommand.update({
        where: { id: input.id },
        data: { enabled: !command.enabled },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("command:updated", { commandId: input.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.toggle",
        resourceType: "TwitchChatCommand",
        resourceId: input.id,
        metadata: { name: command.name, enabled: updated.enabled },
      });

      return updated;
    }),
});
