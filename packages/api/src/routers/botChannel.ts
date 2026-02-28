import { prisma } from "@community-bot/db";
import { protectedProcedure, leadModProcedure, router } from "../index";
import { z } from "zod";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { logAudit } from "../utils/audit";

export const botChannelRouter = router({
  /** Get the current user's bot channel status and linked Twitch account */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Check if user has a linked Twitch account
    const twitchAccount = await prisma.account.findFirst({
      where: { userId, providerId: "twitch" },
    });

    // Check if user has a linked Discord account
    const discordAccount = await prisma.account.findFirst({
      where: { userId, providerId: "discord" },
    });

    // Check if user has a bot channel entry
    const botChannel = await prisma.botChannel.findUnique({
      where: { userId },
      include: { commandOverrides: true },
    });

    return {
      hasTwitchLinked: !!twitchAccount,
      hasDiscordLinked: !!discordAccount,
      twitchUsername: twitchAccount
        ? (
            await prisma.user.findUnique({
              where: { id: userId },
              include: {
                accounts: { where: { providerId: "twitch" } },
              },
            })
          )?.accounts[0]?.accountId ?? null
        : null,
      botChannel: botChannel
        ? {
            id: botChannel.id,
            twitchUsername: botChannel.twitchUsername,
            twitchUserId: botChannel.twitchUserId,
            enabled: botChannel.enabled,
            muted: botChannel.muted,
            aiShoutoutEnabled: botChannel.aiShoutoutEnabled,
            disabledCommands: botChannel.disabledCommands,
            commandOverrides: botChannel.commandOverrides.map((o) => ({
              commandName: o.commandName,
              accessLevel: o.accessLevel,
            })),
            joinedAt: botChannel.joinedAt.toISOString(),
          }
        : null,
    };
  }),

  /** Enable the bot for the current user's Twitch channel */
  enable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get linked Twitch account
    const twitchAccount = await prisma.account.findFirst({
      where: { userId, providerId: "twitch" },
    });

    if (!twitchAccount) {
      throw new Error(
        "No Twitch account linked. Please link your Twitch account first."
      );
    }

    // We need the Twitch username. The accountId from better-auth is the Twitch user ID.
    // We'll fetch the username from the user's name as a fallback.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const twitchUserId = twitchAccount.accountId;
    const twitchUsername = user?.name?.toLowerCase() ?? twitchUserId;

    // Upsert the bot channel
    const botChannel = await prisma.botChannel.upsert({
      where: { userId },
      create: {
        userId,
        twitchUsername,
        twitchUserId,
        enabled: true,
      },
      update: {
        enabled: true,
        twitchUsername,
        twitchUserId,
      },
    });

    // Publish event — lazy import to avoid circular deps at module level
    const { eventBus } = await import("../events");
    await eventBus.publish("channel:join", {
      channelId: botChannel.twitchUserId,
      username: botChannel.twitchUsername,
    });

    await logAudit({
      userId,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "bot.enable",
      resourceType: "BotChannel",
      resourceId: botChannel.id,
      metadata: { twitchUsername: botChannel.twitchUsername },
    });

    return { success: true, botChannel };
  }),

  /** Disable the bot for the current user's Twitch channel */
  disable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const botChannel = await prisma.botChannel.findUnique({
      where: { userId },
    });

    if (!botChannel) {
      throw new Error("Bot is not enabled for your channel.");
    }

    await prisma.botChannel.update({
      where: { userId },
      data: { enabled: false },
    });

    const { eventBus } = await import("../events");
    await eventBus.publish("channel:leave", {
      channelId: botChannel.twitchUserId,
      username: botChannel.twitchUsername,
    });

    await logAudit({
      userId,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "bot.disable",
      resourceType: "BotChannel",
      resourceId: botChannel.id,
      metadata: { twitchUsername: botChannel.twitchUsername },
    });

    return { success: true };
  }),

  /** Mute or unmute the bot in the user's channel */
  mute: leadModProcedure
    .input(z.object({ muted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await prisma.botChannel.findUnique({
        where: { userId },
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      await prisma.botChannel.update({
        where: { userId },
        data: { muted: input.muted },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("bot:mute", {
        channelId: botChannel.twitchUserId,
        username: botChannel.twitchUsername,
        muted: input.muted,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: input.muted ? "bot.mute" : "bot.unmute",
        resourceType: "BotChannel",
        resourceId: botChannel.id,
        metadata: { muted: input.muted },
      });

      return { success: true, muted: input.muted };
    }),

  /** Update which default commands are disabled for this channel */
  updateCommandToggles: leadModProcedure
    .input(z.object({ disabledCommands: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await prisma.botChannel.findUnique({
        where: { userId },
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      // Validate that all command names are valid default commands
      const validNames = DEFAULT_COMMANDS.map((c) => c.name);
      const invalid = input.disabledCommands.filter(
        (n) => !validNames.includes(n)
      );
      if (invalid.length > 0) {
        throw new Error(`Invalid command names: ${invalid.join(", ")}`);
      }

      await prisma.botChannel.update({
        where: { userId },
        data: { disabledCommands: input.disabledCommands },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("commands:defaults-updated", {
        channelId: botChannel.twitchUserId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "bot.command-toggles",
        resourceType: "BotChannel",
        resourceId: botChannel.id,
        metadata: { disabledCommands: input.disabledCommands },
      });

      return { success: true };
    }),

  /** Toggle AI-enhanced shoutouts for this channel */
  toggleAiShoutout: leadModProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await prisma.botChannel.findUnique({
        where: { userId },
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      await prisma.botChannel.update({
        where: { userId },
        data: { aiShoutoutEnabled: input.enabled },
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: input.enabled ? "bot.ai-shoutout-enable" : "bot.ai-shoutout-disable",
        resourceType: "BotChannel",
        resourceId: botChannel.id,
        metadata: { aiShoutoutEnabled: input.enabled },
      });

      return { success: true, aiShoutoutEnabled: input.enabled };
    }),

  /** Update the access level override for a default command */
  updateCommandAccessLevel: leadModProcedure
    .input(
      z.object({
        commandName: z.string(),
        accessLevel: z.enum([
          "EVERYONE",
          "SUBSCRIBER",
          "REGULAR",
          "VIP",
          "MODERATOR",
          "LEAD_MODERATOR",
          "BROADCASTER",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await prisma.botChannel.findUnique({
        where: { userId },
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      // Validate command name
      const validNames = DEFAULT_COMMANDS.map((c) => c.name);
      if (!validNames.includes(input.commandName)) {
        throw new Error(`Invalid command name: ${input.commandName}`);
      }

      // Find the default access level for this command
      const defaultCmd = DEFAULT_COMMANDS.find(
        (c) => c.name === input.commandName
      )!;

      // If setting back to default, delete the override
      if (input.accessLevel === defaultCmd.accessLevel) {
        await prisma.defaultCommandOverride.deleteMany({
          where: {
            botChannelId: botChannel.id,
            commandName: input.commandName,
          },
        });
      } else {
        await prisma.defaultCommandOverride.upsert({
          where: {
            botChannelId_commandName: {
              botChannelId: botChannel.id,
              commandName: input.commandName,
            },
          },
          create: {
            botChannelId: botChannel.id,
            commandName: input.commandName,
            accessLevel: input.accessLevel,
          },
          update: {
            accessLevel: input.accessLevel,
          },
        });
      }

      const { eventBus } = await import("../events");
      await eventBus.publish("commands:defaults-updated", {
        channelId: botChannel.twitchUserId,
      });

      await logAudit({
        userId,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "bot.command-access-level",
        resourceType: "BotChannel",
        resourceId: botChannel.id,
        metadata: { commandName: input.commandName, accessLevel: input.accessLevel },
      });

      return { success: true };
    }),
});
