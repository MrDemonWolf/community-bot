import { db, eq, botChannels } from "@community-bot/db";
import { TRPCError } from "@trpc/server";

/**
 * Fetch the bot channel for a user, throwing if the bot is not enabled.
 * Shared across all tRPC routers that operate on per-channel resources.
 */
/**
 * Assert that an entity exists and belongs to the given bot channel.
 * Throws NOT_FOUND if the item is missing or owned by a different channel.
 */
export function assertOwnership<T extends { botChannelId: string | null }>(
  item: T | undefined | null,
  botChannel: { id: string },
  entityName: string = "Resource",
): asserts item is T & { botChannelId: string } {
  if (!item || item.botChannelId !== botChannel.id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${entityName} not found.`,
    });
  }
}

export async function getUserBotChannel(userId: string) {
  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, userId),
  });

  if (!botChannel || !botChannel.enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Bot is not enabled for your channel.",
    });
  }

  return botChannel;
}
