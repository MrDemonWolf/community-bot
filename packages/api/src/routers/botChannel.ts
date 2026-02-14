import { prisma } from "@community-bot/db";
import { protectedProcedure, router } from "../index";

export const botChannelRouter = router({
  /** Get the current user's bot channel status and linked Twitch account */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Check if user has a linked Twitch account
    const twitchAccount = await prisma.account.findFirst({
      where: { userId, providerId: "twitch" },
    });

    // Check if user has a bot channel entry
    const botChannel = await prisma.botChannel.findUnique({
      where: { userId },
    });

    return {
      hasTwitchLinked: !!twitchAccount,
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
            joinedAt: botChannel.joinedAt.toISOString(),
          }
        : null,
    };
  }),

  /** Enable the bot for the current user's Twitch channel */
  enable: protectedProcedure.mutation(async ({ ctx }) => {
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

    return { success: true, botChannel };
  }),

  /** Disable the bot for the current user's Twitch channel */
  disable: protectedProcedure.mutation(async ({ ctx }) => {
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

    return { success: true };
  }),
});
