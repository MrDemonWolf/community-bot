import { prisma, QueueStatus } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function publishQueueUpdated() {
  const { eventBus } = await import("../events");
  await eventBus.publish("queue:updated", { channelId: "singleton" });
}

export const queueRouter = router({
  getState: protectedProcedure.query(async () => {
    const state = await prisma.queueState.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", status: QueueStatus.CLOSED },
    });
    return state;
  }),

  list: protectedProcedure.query(async () => {
    return prisma.queueEntry.findMany({
      orderBy: { position: "asc" },
    });
  }),

  setStatus: moderatorProcedure
    .input(z.object({ status: z.enum(["OPEN", "CLOSED", "PAUSED"]) }))
    .mutation(async ({ ctx, input }) => {
      const state = await prisma.queueState.upsert({
        where: { id: "singleton" },
        update: { status: input.status },
        create: { id: "singleton", status: input.status },
      });

      const actionMap = {
        OPEN: "queue.open",
        CLOSED: "queue.close",
        PAUSED: "queue.pause",
      } as const;

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: actionMap[input.status],
        resourceType: "QueueState",
        resourceId: "singleton",
        metadata: { status: input.status },
      });

      await publishQueueUpdated();

      return state;
    }),

  removeEntry: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await prisma.queueEntry.findUnique({
        where: { id: input.id },
      });

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Queue entry not found.",
        });
      }

      await prisma.queueEntry.delete({ where: { id: input.id } });

      // Reorder positions for entries after the removed one
      await prisma.$executeRawUnsafe(
        `UPDATE "QueueEntry" SET position = position - 1 WHERE position > $1`,
        entry.position
      );

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "queue.remove-entry",
        resourceType: "QueueEntry",
        resourceId: input.id,
        metadata: { twitchUsername: entry.twitchUsername },
      });

      await publishQueueUpdated();

      return { success: true };
    }),

  pickEntry: moderatorProcedure
    .input(z.object({ mode: z.enum(["next", "random"]) }))
    .mutation(async ({ ctx, input }) => {
      let entry;

      if (input.mode === "next") {
        entry = await prisma.queueEntry.findFirst({
          orderBy: { position: "asc" },
        });
      } else {
        const count = await prisma.queueEntry.count();
        if (count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Queue is empty.",
          });
        }
        const skip = Math.floor(Math.random() * count);
        entry = await prisma.queueEntry.findFirst({
          orderBy: { position: "asc" },
          skip,
        });
      }

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Queue is empty.",
        });
      }

      await prisma.queueEntry.delete({ where: { id: entry.id } });

      // Reorder positions
      await prisma.$executeRawUnsafe(
        `UPDATE "QueueEntry" SET position = position - 1 WHERE position > $1`,
        entry.position
      );

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "queue.pick",
        resourceType: "QueueEntry",
        resourceId: entry.id,
        metadata: {
          twitchUsername: entry.twitchUsername,
          mode: input.mode,
          position: entry.position,
        },
      });

      await publishQueueUpdated();

      return entry;
    }),

  clear: moderatorProcedure.mutation(async ({ ctx }) => {
    const count = await prisma.queueEntry.count();

    await prisma.queueEntry.deleteMany();

    await logAudit({
      userId: ctx.session.user.id,
      userName: ctx.session.user.name,
      userImage: ctx.session.user.image,
      action: "queue.clear",
      resourceType: "QueueEntry",
      resourceId: "all",
      metadata: { entriesCleared: count },
    });

    await publishQueueUpdated();

    return { success: true, cleared: count };
  }),
});
