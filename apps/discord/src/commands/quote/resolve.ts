import { prisma } from "@community-bot/db";

/**
 * Resolves the botChannelId for a Discord guild by looking up the
 * guild's linked userId and finding the corresponding BotChannel.
 */
export async function resolveBotChannelId(
  guildId: string
): Promise<string | null> {
  const guild = await prisma.discordGuild.findUnique({
    where: { guildId },
    select: { userId: true },
  });

  if (!guild?.userId) return null;

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: guild.userId },
    select: { id: true },
  });

  return botChannel?.id ?? null;
}
