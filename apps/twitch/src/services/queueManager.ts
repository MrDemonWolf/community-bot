import { prisma } from "@community-bot/db";
import { QueueStatus } from "@community-bot/db";

export async function getQueueStatus(): Promise<QueueStatus> {
  const state = await prisma.queueState.findUnique({
    where: { id: "singleton" },
  });
  return state?.status ?? QueueStatus.CLOSED;
}

export async function setQueueStatus(status: QueueStatus): Promise<void> {
  await prisma.queueState.upsert({
    where: { id: "singleton" },
    update: { status },
    create: { id: "singleton", status },
  });
}

export async function join(
  userId: string,
  username: string
): Promise<{ ok: true; position: number } | { ok: false; reason: string }> {
  const status = await getQueueStatus();
  if (status !== QueueStatus.OPEN) {
    return { ok: false, reason: "The queue is not open." };
  }

  const existing = await prisma.queueEntry.findUnique({
    where: { twitchUserId: userId },
  });
  if (existing) {
    return { ok: false, reason: `You are already in the queue at position ${existing.position}.` };
  }

  const last = await prisma.queueEntry.findFirst({
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? 0) + 1;

  await prisma.queueEntry.create({
    data: { twitchUserId: userId, twitchUsername: username, position },
  });

  return { ok: true, position };
}

export async function leave(userId: string): Promise<boolean> {
  const entry = await prisma.queueEntry.findUnique({
    where: { twitchUserId: userId },
  });
  if (!entry) return false;

  await prisma.queueEntry.delete({ where: { id: entry.id } });

  // Reorder positions for entries after the removed one
  await prisma.$executeRawUnsafe(
    `UPDATE "QueueEntry" SET position = position - 1 WHERE position > $1`,
    entry.position
  );

  return true;
}

export async function getPosition(userId: string): Promise<number | null> {
  const entry = await prisma.queueEntry.findUnique({
    where: { twitchUserId: userId },
  });
  return entry?.position ?? null;
}

export async function listEntries() {
  return prisma.queueEntry.findMany({
    orderBy: { position: "asc" },
  });
}

export async function pick(
  mode: "next" | "random" | string
): Promise<{ twitchUsername: string; position: number } | null> {
  let entry;

  if (mode === "next") {
    entry = await prisma.queueEntry.findFirst({
      orderBy: { position: "asc" },
    });
  } else if (mode === "random") {
    const count = await prisma.queueEntry.count();
    if (count === 0) return null;
    const skip = Math.floor(Math.random() * count);
    entry = await prisma.queueEntry.findFirst({
      orderBy: { position: "asc" },
      skip,
    });
  } else {
    // Pick by username
    entry = await prisma.queueEntry.findFirst({
      where: { twitchUsername: { equals: mode, mode: "insensitive" } },
    });
  }

  if (!entry) return null;

  await prisma.queueEntry.delete({ where: { id: entry.id } });

  // Reorder positions
  await prisma.$executeRawUnsafe(
    `UPDATE "QueueEntry" SET position = position - 1 WHERE position > $1`,
    entry.position
  );

  return { twitchUsername: entry.twitchUsername, position: entry.position };
}

export async function remove(username: string): Promise<boolean> {
  const entry = await prisma.queueEntry.findFirst({
    where: { twitchUsername: { equals: username, mode: "insensitive" } },
  });
  if (!entry) return false;

  await prisma.queueEntry.delete({ where: { id: entry.id } });

  await prisma.$executeRawUnsafe(
    `UPDATE "QueueEntry" SET position = position - 1 WHERE position > $1`,
    entry.position
  );

  return true;
}

export async function clear(): Promise<void> {
  await prisma.queueEntry.deleteMany();
}
