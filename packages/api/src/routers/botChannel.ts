import { db, eq, and, count, accounts, users, botChannels, defaultCommandOverrides, quotes, twitchCounters, twitchTimers, songRequests, giveaways } from "@community-bot/db";
import { protectedProcedure, leadModProcedure, router } from "../index";
import { z } from "zod";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { applyMutationEffects } from "../utils/mutation";
import { accessLevelEnum } from "../schemas/common";

export const botChannelRouter = router({
  /** Get the current user's bot channel status and linked Twitch account */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Check if user has a linked Twitch account
    const twitchAccount = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.providerId, "twitch")),
    });

    // Check if user has a linked Discord account
    const discordAccount = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.providerId, "discord")),
    });

    // Check if user has a bot channel entry
    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.userId, userId),
      with: { commandOverrides: true },
    });

    return {
      hasTwitchLinked: !!twitchAccount,
      hasDiscordLinked: !!discordAccount,
      twitchUsername: twitchAccount?.accountId ?? null,
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
    const twitchAccount = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.providerId, "twitch")),
    });

    if (!twitchAccount) {
      throw new Error(
        "No Twitch account linked. Please link your Twitch account first."
      );
    }

    // We need the Twitch username. The accountId from better-auth is the Twitch user ID.
    // We'll fetch the username from the user's name as a fallback.
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const twitchUserId = twitchAccount.accountId;
    const twitchUsername = user?.name?.toLowerCase() ?? twitchUserId;

    // Upsert the bot channel
    const [botChannel] = await db.insert(botChannels).values({
      userId,
      twitchUsername,
      twitchUserId,
      enabled: true,
    }).onConflictDoUpdate({
      target: botChannels.userId,
      set: {
        enabled: true,
        twitchUsername,
        twitchUserId,
      },
    }).returning();

    // Publish event and audit log
    await applyMutationEffects(ctx, {
      event: { name: "channel:join", payload: { channelId: botChannel!.twitchUserId, username: botChannel!.twitchUsername } },
      audit: { action: "bot.enable", resourceType: "BotChannel", resourceId: botChannel!.id, metadata: { twitchUsername: botChannel!.twitchUsername } },
    });

    return { success: true, botChannel };
  }),

  /** Disable the bot for the current user's Twitch channel */
  disable: leadModProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.userId, userId),
    });

    if (!botChannel) {
      throw new Error("Bot is not enabled for your channel.");
    }

    await db.update(botChannels).set({ enabled: false }).where(eq(botChannels.userId, userId));

    await applyMutationEffects(ctx, {
      event: { name: "channel:leave", payload: { channelId: botChannel.twitchUserId, username: botChannel.twitchUsername } },
      audit: { action: "bot.disable", resourceType: "BotChannel", resourceId: botChannel.id, metadata: { twitchUsername: botChannel.twitchUsername } },
    });

    return { success: true };
  }),

  /** Mute or unmute the bot in the user's channel */
  mute: leadModProcedure
    .input(z.object({ muted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, userId),
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      await db.update(botChannels).set({ muted: input.muted }).where(eq(botChannels.userId, userId));

      await applyMutationEffects(ctx, {
        event: { name: "bot:mute", payload: { channelId: botChannel.twitchUserId, username: botChannel.twitchUsername, muted: input.muted } },
        audit: { action: input.muted ? "bot.mute" : "bot.unmute", resourceType: "BotChannel", resourceId: botChannel.id, metadata: { muted: input.muted } },
      });

      return { success: true, muted: input.muted };
    }),

  /** Update which default commands are disabled for this channel */
  updateCommandToggles: leadModProcedure
    .input(z.object({ disabledCommands: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, userId),
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

      await db.update(botChannels).set({ disabledCommands: input.disabledCommands }).where(eq(botChannels.userId, userId));

      await applyMutationEffects(ctx, {
        event: { name: "commands:defaults-updated", payload: { channelId: botChannel.twitchUserId } },
        audit: { action: "bot.command-toggles", resourceType: "BotChannel", resourceId: botChannel.id, metadata: { disabledCommands: input.disabledCommands } },
      });

      return { success: true };
    }),

  /** Toggle AI-enhanced shoutouts for this channel */
  toggleAiShoutout: leadModProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, userId),
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      await db.update(botChannels).set({ aiShoutoutEnabled: input.enabled }).where(eq(botChannels.userId, userId));

      await applyMutationEffects(ctx, {
        audit: { action: input.enabled ? "bot.ai-shoutout-enable" : "bot.ai-shoutout-disable", resourceType: "BotChannel", resourceId: botChannel.id, metadata: { aiShoutoutEnabled: input.enabled } },
      });

      return { success: true, aiShoutoutEnabled: input.enabled };
    }),

  /** Update the access level override for a default command */
  updateCommandAccessLevel: leadModProcedure
    .input(
      z.object({
        commandName: z.string(),
        accessLevel: accessLevelEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, userId),
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
        await db.delete(defaultCommandOverrides).where(
          and(
            eq(defaultCommandOverrides.botChannelId, botChannel.id),
            eq(defaultCommandOverrides.commandName, input.commandName),
          )
        );
      } else {
        await db.insert(defaultCommandOverrides).values({
          botChannelId: botChannel.id,
          commandName: input.commandName,
          accessLevel: input.accessLevel,
        }).onConflictDoUpdate({
          target: [defaultCommandOverrides.botChannelId, defaultCommandOverrides.commandName],
          set: {
            accessLevel: input.accessLevel,
          },
        });
      }

      await applyMutationEffects(ctx, {
        event: { name: "commands:defaults-updated", payload: { channelId: botChannel.twitchUserId } },
        audit: { action: "bot.command-access-level", resourceType: "BotChannel", resourceId: botChannel.id, metadata: { commandName: input.commandName, accessLevel: input.accessLevel } },
      });

      return { success: true };
    }),

  /** Get extended stats for the current user's bot channel */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.userId, userId),
    });

    if (!botChannel || !botChannel.enabled) {
      return { quotes: 0, counters: 0, timers: 0, songRequests: 0, giveaways: 0 };
    }

    const [quotesResult, countersResult, timersResult, songRequestsResult, giveawaysResult] = await Promise.all([
      db.select({ value: count() }).from(quotes).where(eq(quotes.botChannelId, botChannel.id)),
      db.select({ value: count() }).from(twitchCounters).where(eq(twitchCounters.botChannelId, botChannel.id)),
      db.select({ value: count() }).from(twitchTimers).where(and(eq(twitchTimers.botChannelId, botChannel.id), eq(twitchTimers.enabled, true))),
      db.select({ value: count() }).from(songRequests).where(eq(songRequests.botChannelId, botChannel.id)),
      db.select({ value: count() }).from(giveaways).where(eq(giveaways.botChannelId, botChannel.id)),
    ]);

    return { quotes: quotesResult[0]?.value ?? 0, counters: countersResult[0]?.value ?? 0, timers: timersResult[0]?.value ?? 0, songRequests: songRequestsResult[0]?.value ?? 0, giveaways: giveawaysResult[0]?.value ?? 0 };
  }),
});
