import { prisma } from "@community-bot/db";

export async function startGiveaway(
  botChannelId: string,
  keyword: string,
  title: string
) {
  // End any existing active giveaway
  await prisma.giveaway.updateMany({
    where: { botChannelId, isActive: true },
    data: { isActive: false },
  });

  return prisma.giveaway.create({
    data: { botChannelId, keyword: keyword.toLowerCase(), title },
  });
}

export async function getActiveGiveaway(botChannelId: string) {
  return prisma.giveaway.findFirst({
    where: { botChannelId, isActive: true },
    include: { entries: true },
  });
}

export async function addEntry(
  botChannelId: string,
  twitchUsername: string,
  twitchUserId: string,
  message?: string
) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { botChannelId, isActive: true },
  });
  if (!giveaway) return null;

  // If message provided, check if it matches the keyword
  if (message !== undefined && message.trim().toLowerCase() !== giveaway.keyword) {
    return null;
  }

  try {
    return await prisma.giveawayEntry.create({
      data: {
        giveawayId: giveaway.id,
        twitchUsername,
        twitchUserId,
      },
    });
  } catch {
    // Unique constraint violation means already entered
    return null;
  }
}

export async function drawWinner(botChannelId: string) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { botChannelId, isActive: true },
    include: { entries: true },
  });
  if (!giveaway || giveaway.entries.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * giveaway.entries.length);
  const winner = giveaway.entries[randomIndex];

  await prisma.giveaway.update({
    where: { id: giveaway.id },
    data: { winnerName: winner.twitchUsername },
  });

  return winner.twitchUsername;
}

export async function endGiveaway(botChannelId: string): Promise<{ count: number }> {
  return prisma.giveaway.updateMany({
    where: { botChannelId, isActive: true },
    data: { isActive: false },
  });
}

export async function getEntryCount(botChannelId: string) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { botChannelId, isActive: true },
  });
  if (!giveaway) return 0;

  return prisma.giveawayEntry.count({
    where: { giveawayId: giveaway.id },
  });
}
