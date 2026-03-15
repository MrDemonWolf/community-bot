import { db, eq, count, asc, desc, sql } from "@community-bot/db";
import { queueEntries, queueStates } from "@community-bot/db";
import { QueueStatus } from "@community-bot/db";
import { getEventBus } from "./eventBusAccessor.js";

async function publishQueueUpdated(): Promise<void> {
  try {
    const eventBus = getEventBus();
    await eventBus.publish("queue:updated", { channelId: "singleton" });
  } catch {
    // EventBus may not be initialized during early startup
  }
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const state = await db.query.queueStates.findFirst({
    where: eq(queueStates.id, "singleton"),
  });
  return (state?.status as typeof QueueStatus[keyof typeof QueueStatus]) ?? QueueStatus.CLOSED;
}

export async function setQueueStatus(status: QueueStatus): Promise<void> {
  await db
    .insert(queueStates)
    .values({ id: "singleton", status })
    .onConflictDoUpdate({
      target: queueStates.id,
      set: { status },
    });
  await publishQueueUpdated();
}

export async function join(
  userId: string,
  username: string
): Promise<{ ok: true; position: number } | { ok: false; reason: string }> {
  const status = await getQueueStatus();
  if (status !== QueueStatus.OPEN) {
    return { ok: false, reason: "The queue is not open." };
  }

  const existing = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.twitchUserId, userId),
  });
  if (existing) {
    return { ok: false, reason: `You are already in the queue at position ${existing.position}.` };
  }

  const last = await db.query.queueEntries.findFirst({
    orderBy: desc(queueEntries.position),
  });
  const position = (last?.position ?? 0) + 1;

  await db.insert(queueEntries).values({ twitchUserId: userId, twitchUsername: username, position });

  await publishQueueUpdated();
  return { ok: true, position };
}

export async function leave(userId: string): Promise<boolean> {
  const entry = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.twitchUserId, userId),
  });
  if (!entry) return false;

  await db.delete(queueEntries).where(eq(queueEntries.id, entry.id));

  // Reorder positions for entries after the removed one
  await db.execute(
    sql`UPDATE "QueueEntry" SET position = position - 1 WHERE position > ${entry.position}`
  );

  await publishQueueUpdated();
  return true;
}

export async function getPosition(userId: string): Promise<number | null> {
  const entry = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.twitchUserId, userId),
  });
  return entry?.position ?? null;
}

export async function listEntries() {
  return db.query.queueEntries.findMany({
    orderBy: asc(queueEntries.position),
  });
}

export async function pick(
  mode: "next" | "random" | string
): Promise<{ twitchUsername: string; position: number } | null> {
  let entry;

  if (mode === "next") {
    entry = await db.query.queueEntries.findFirst({
      orderBy: asc(queueEntries.position),
    });
  } else if (mode === "random") {
    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(queueEntries);
    if (totalCount === 0) return null;
    const skip = Math.floor(Math.random() * totalCount);
    entry = await db.query.queueEntries.findFirst({
      orderBy: asc(queueEntries.position),
      offset: skip,
    });
  } else {
    // Pick by username
    entry = await db.query.queueEntries.findFirst({
      where: sql`lower(${queueEntries.twitchUsername}) = lower(${mode})`,
    });
  }

  if (!entry) return null;

  await db.delete(queueEntries).where(eq(queueEntries.id, entry.id));

  // Reorder positions
  await db.execute(
    sql`UPDATE "QueueEntry" SET position = position - 1 WHERE position > ${entry.position}`
  );

  await publishQueueUpdated();
  return { twitchUsername: entry.twitchUsername, position: entry.position };
}

export async function remove(username: string): Promise<boolean> {
  const entry = await db.query.queueEntries.findFirst({
    where: sql`lower(${queueEntries.twitchUsername}) = lower(${username})`,
  });
  if (!entry) return false;

  await db.delete(queueEntries).where(eq(queueEntries.id, entry.id));

  await db.execute(
    sql`UPDATE "QueueEntry" SET position = position - 1 WHERE position > ${entry.position}`
  );

  await publishQueueUpdated();
  return true;
}

export async function clear(): Promise<void> {
  await db.delete(queueEntries);
  await publishQueueUpdated();
}
