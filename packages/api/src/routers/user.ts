import { prisma } from "@community-bot/db";
import { protectedProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const SE_ACCESS_LEVEL_MAP: Record<number, string> = {
  100: "EVERYONE",
  250: "REGULAR",
  300: "SUBSCRIBER",
  400: "VIP",
  500: "MODERATOR",
  1000: "BROADCASTER",
};

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        accounts: {
          select: {
            providerId: true,
            accountId: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      connectedAccounts: user.accounts.map((a) => ({
        provider: a.providerId,
        accountId: a.accountId,
      })),
    };
  }),

  exportData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            providerId: true,
            accountId: true,
            scope: true,
          },
        },
        botChannel: {
          include: {
            customCommands: true,
            commandOverrides: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
    }

    return {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      connectedAccounts: user.accounts.map((a) => ({
        provider: a.providerId,
        accountId: a.accountId,
        scope: a.scope,
      })),
      botChannel: user.botChannel
        ? {
            twitchUsername: user.botChannel.twitchUsername,
            twitchUserId: user.botChannel.twitchUserId,
            enabled: user.botChannel.enabled,
            muted: user.botChannel.muted,
            disabledCommands: user.botChannel.disabledCommands,
            commandOverrides: user.botChannel.commandOverrides.map((o) => ({
              commandName: o.commandName,
              accessLevel: o.accessLevel,
            })),
            customCommands: user.botChannel.customCommands.map((c) => ({
              name: c.name,
              response: c.response,
              responseType: c.responseType,
              accessLevel: c.accessLevel,
              globalCooldown: c.globalCooldown,
              userCooldown: c.userCooldown,
              streamStatus: c.streamStatus,
              aliases: c.aliases,
              hidden: c.hidden,
              enabled: c.enabled,
            })),
          }
        : null,
    };
  }),

  importStreamElements: protectedProcedure
    .input(
      z.object({
        commands: z.array(
          z.object({
            command: z.string(),
            response: z.string(),
            accessLevel: z.number().optional(),
            enabled: z.boolean().optional(),
            cooldown: z
              .object({
                global: z.number().optional(),
                user: z.number().optional(),
              })
              .optional(),
            aliases: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await prisma.botChannel.findUnique({
        where: { userId },
      });

      if (!botChannel || !botChannel.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bot is not enabled for your channel.",
        });
      }

      let imported = 0;
      let skipped = 0;
      const createdIds: string[] = [];

      for (const cmd of input.commands) {
        // Clean command name: remove leading "!" and lowercase
        const name = cmd.command.replace(/^!/, "").toLowerCase().trim();

        // Skip invalid names
        if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
          skipped++;
          continue;
        }

        // Skip if command already exists
        const existing = await prisma.twitchChatCommand.findUnique({
          where: { name_botChannelId: { name, botChannelId: botChannel.id } },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Map SE access level
        const accessLevel =
          SE_ACCESS_LEVEL_MAP[cmd.accessLevel ?? 100] ?? "EVERYONE";

        const command = await prisma.twitchChatCommand.create({
          data: {
            name,
            response: cmd.response.slice(0, 500),
            accessLevel: accessLevel as any,
            globalCooldown: cmd.cooldown?.global ?? 0,
            userCooldown: cmd.cooldown?.user ?? 0,
            enabled: cmd.enabled ?? true,
            aliases: (cmd.aliases ?? [])
              .map((a) => a.replace(/^!/, "").toLowerCase().trim())
              .filter((a) => a.length > 0),
            botChannelId: botChannel.id,
          },
        });

        createdIds.push(command.id);
        imported++;
      }

      // Publish events for bot reload
      if (createdIds.length > 0) {
        const { eventBus } = await import("../events");
        for (const commandId of createdIds) {
          await eventBus.publish("command:created", { commandId });
        }
      }

      return { imported, skipped };
    }),
});
