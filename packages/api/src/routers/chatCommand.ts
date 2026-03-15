import { db, eq, and, asc, twitchChatCommands } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

const DEFAULT_COMMAND_NAMES = new Set(DEFAULT_COMMANDS.map((c) => c.name));

export const chatCommandRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const commands = await db.query.twitchChatCommands.findMany({
      where: eq(twitchChatCommands.botChannelId, botChannel.id),
      orderBy: asc(twitchChatCommands.name),
    });

    return commands;
  }),

  create: moderatorProcedure
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
      const existing = await db.query.twitchChatCommands.findFirst({
        where: and(eq(twitchChatCommands.name, name), eq(twitchChatCommands.botChannelId, botChannel.id)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Command "!${name}" already exists.`,
        });
      }

      const [command] = await db.insert(twitchChatCommands).values({
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
      }).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("command:created", { commandId: command!.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.create",
        resourceType: "TwitchChatCommand",
        resourceId: command!.id,
        metadata: { name },
      });

      return command!;
    }),

  update: moderatorProcedure
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

      const command = await db.query.twitchChatCommands.findFirst({
        where: eq(twitchChatCommands.id, input.id),
      });

      if (!command || command.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      const { id, expiresAt, aliases, name, ...rest } = input;

      const [command_updated] = await db.update(twitchChatCommands).set({
        ...rest,
        ...(name !== undefined ? { name: name.toLowerCase() } : {}),
        ...(aliases !== undefined
          ? { aliases: aliases.map((a) => a.toLowerCase()) }
          : {}),
        ...(expiresAt !== undefined
          ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
          : {}),
      }).where(eq(twitchChatCommands.id, id)).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("command:updated", { commandId: id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.update",
        resourceType: "TwitchChatCommand",
        resourceId: id,
        metadata: { name: command_updated!.name },
      });

      return command_updated!;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const command = await db.query.twitchChatCommands.findFirst({
        where: eq(twitchChatCommands.id, input.id),
      });

      if (!command || command.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      await db.delete(twitchChatCommands).where(eq(twitchChatCommands.id, input.id));

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

  toggleEnabled: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const command = await db.query.twitchChatCommands.findFirst({
        where: eq(twitchChatCommands.id, input.id),
      });

      if (!command || command.botChannelId !== botChannel.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Command not found.",
        });
      }

      const [updated] = await db.update(twitchChatCommands).set({ enabled: !command.enabled }).where(eq(twitchChatCommands.id, input.id)).returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("command:updated", { commandId: input.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "command.toggle",
        resourceType: "TwitchChatCommand",
        resourceId: input.id,
        metadata: { name: command.name, enabled: updated!.enabled },
      });

      return updated!;
    }),
});
