import { db, eq, and, count } from "@community-bot/db";
import { giveaways, giveawayEntries } from "@community-bot/db";

export async function startGiveaway(
  botChannelId: string,
  keyword: string,
  title: string
) {
  // End any existing active giveaway
  await db
    .update(giveaways)
    .set({ isActive: false })
    .where(and(eq(giveaways.botChannelId, botChannelId), eq(giveaways.isActive, true)));

  const [created] = await db
    .insert(giveaways)
    .values({ botChannelId, keyword: keyword.toLowerCase(), title })
    .returning();
  return created;
}

export async function getActiveGiveaway(botChannelId: string) {
  return db.query.giveaways.findFirst({
    where: and(eq(giveaways.botChannelId, botChannelId), eq(giveaways.isActive, true)),
    with: { entries: true },
  }) ?? null;
}

export async function addEntry(
  botChannelId: string,
  twitchUsername: string,
  twitchUserId: string,
  message?: string
) {
  const giveaway = await db.query.giveaways.findFirst({
    where: and(eq(giveaways.botChannelId, botChannelId), eq(giveaways.isActive, true)),
  });
  if (!giveaway) return null;

  // If message provided, check if it matches the keyword
  if (message !== undefined && message.trim().toLowerCase() !== giveaway.keyword) {
    return null;
  }

  try {
    const [created] = await db
      .insert(giveawayEntries)
      .values({
        giveawayId: giveaway.id,
        twitchUsername,
        twitchUserId,
      })
      .returning();
    return created;
  } catch {
    // Unique constraint violation means already entered
    return null;
  }
}

export async function drawWinner(botChannelId: string) {
  const giveaway = await db.query.giveaways.findFirst({
    where: and(eq(giveaways.botChannelId, botChannelId), eq(giveaways.isActive, true)),
    with: { entries: true },
  });
  if (!giveaway || giveaway.entries.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * giveaway.entries.length);
  const winner = giveaway.entries[randomIndex];

  await db
    .update(giveaways)
    .set({ winnerName: winner.twitchUsername })
    .where(eq(giveaways.id, giveaway.id));

  return winner.twitchUsername;
}

export async function endGiveaway(botChannelId: string): Promise<{ count: number }> {
  const result = await db
    .update(giveaways)
    .set({ isActive: false })
    .where(and(eq(giveaways.botChannelId, botChannelId), eq(giveaways.isActive, true)))
    .returning();
  return { count: result.length };
}

export async function getEntryCount(botChannelId: string) {
  const giveaway = await db.query.giveaways.findFirst({
    where: and(eq(giveaways.botChannelId, botChannelId), eq(giveaways.isActive, true)),
  });
  if (!giveaway) return 0;

  const [{ value }] = await db
    .select({ value: count() })
    .from(giveawayEntries)
    .where(eq(giveawayEntries.giveawayId, giveaway.id));
  return value;
}
