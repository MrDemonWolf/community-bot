import { db, eq, discordGuilds, botChannels } from "@community-bot/db";

/**
 * Resolves the botChannelId for a Discord guild by looking up the
 * guild's linked userId and finding the corresponding BotChannel.
 */
export async function resolveBotChannelId(
  guildId: string
): Promise<string | null> {
  const guild = await db.query.discordGuilds.findFirst({
    where: eq(discordGuilds.guildId, guildId),
    columns: { userId: true },
  });

  if (!guild?.userId) return null;

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, guild.userId),
    columns: { id: true },
  });

  return botChannel?.id ?? null;
}
