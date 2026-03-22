import { db, eq, asc, count, sql, QueueStatus, queueEntries, queueStates } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";
import { idInput } from "../schemas/common";

export const queueRouter = router({
  getState: protectedProcedure.query(async () => {
    const [state] = await db.insert(queueStates).values({
      id: "singleton",
      status: QueueStatus.CLOSED,
    }).onConflictDoUpdate({
      target: queueStates.id,
      set: {},
    }).returning();
    return state;
  }),

  list: protectedProcedure.query(async () => {
    return db.query.queueEntries.findMany({
      orderBy: asc(queueEntries.position),
    });
  }),

  setStatus: moderatorProcedure
    .input(z.object({ status: z.enum(["OPEN", "CLOSED", "PAUSED"]) }))
    .mutation(async ({ ctx, input }) => {
      const [state] = await db.insert(queueStates).values({
        id: "singleton",
        status: input.status,
      }).onConflictDoUpdate({
        target: queueStates.id,
        set: { status: input.status },
      }).returning();

      const actionMap = {
        OPEN: "queue.open",
        CLOSED: "queue.close",
        PAUSED: "queue.pause",
      } as const;

      await applyMutationEffects(ctx, {
        event: { name: "queue:updated", payload: { channelId: "singleton" } },
        audit: { action: actionMap[input.status], resourceType: "QueueState", resourceId: "singleton", metadata: { status: input.status } },
      });

      return state;
    }),

  removeEntry: moderatorProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.id, input.id),
      });

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Queue entry not found.",
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(queueEntries).where(eq(queueEntries.id, input.id));
        await tx.execute(sql`UPDATE "QueueEntry" SET position = position - 1 WHERE position > ${entry.position}`);
      });

      await applyMutationEffects(ctx, {
        event: { name: "queue:updated", payload: { channelId: "singleton" } },
        audit: { action: "queue.remove-entry", resourceType: "QueueEntry", resourceId: input.id, metadata: { twitchUsername: entry.twitchUsername } },
      });

      return { success: true };
    }),

  pickEntry: moderatorProcedure
    .input(z.object({ mode: z.enum(["next", "random"]) }))
    .mutation(async ({ ctx, input }) => {
      let entry;

      if (input.mode === "next") {
        entry = await db.query.queueEntries.findFirst({
          orderBy: asc(queueEntries.position),
        });
      } else {
        const totalResult = await db.select({ value: count() }).from(queueEntries);
        const totalCount = totalResult[0]?.value ?? 0;
        if (totalCount === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Queue is empty.",
          });
        }
        const skip = Math.floor(Math.random() * totalCount);
        entry = await db.query.queueEntries.findFirst({
          orderBy: asc(queueEntries.position),
          offset: skip,
        });
      }

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Queue is empty.",
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(queueEntries).where(eq(queueEntries.id, entry.id));
        await tx.execute(sql`UPDATE "QueueEntry" SET position = position - 1 WHERE position > ${entry.position}`);
      });

      await applyMutationEffects(ctx, {
        event: { name: "queue:updated", payload: { channelId: "singleton" } },
        audit: { action: "queue.pick", resourceType: "QueueEntry", resourceId: entry.id, metadata: { twitchUsername: entry.twitchUsername, mode: input.mode, position: entry.position } },
      });

      return entry;
    }),

  clear: moderatorProcedure.mutation(async ({ ctx }) => {
    const clearResult = await db.select({ value: count() }).from(queueEntries);
    const totalCount = clearResult[0]?.value ?? 0;

    await db.delete(queueEntries);

    await applyMutationEffects(ctx, {
      event: { name: "queue:updated", payload: { channelId: "singleton" } },
      audit: { action: "queue.clear", resourceType: "QueueEntry", resourceId: "all", metadata: { entriesCleared: totalCount } },
    });

    return { success: true, cleared: totalCount };
  }),
});
