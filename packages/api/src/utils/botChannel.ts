import { prisma } from "@community-bot/db";
import { TRPCError } from "@trpc/server";

/**
 * Fetch the bot channel for a user, throwing if the bot is not enabled.
 * Shared across all tRPC routers that operate on per-channel resources.
 */
export async function getUserBotChannel(userId: string) {
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
