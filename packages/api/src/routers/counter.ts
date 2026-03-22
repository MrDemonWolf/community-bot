import { db, eq, and, asc, twitchCounters } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getUserBotChannel, assertOwnership } from "../utils/botChannel";
import { applyMutationEffects } from "../utils/mutation";
import { idInput, nameField } from "../schemas/common";

export const counterRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.twitchCounters.findMany({
      where: eq(twitchCounters.botChannelId, botChannel.id),
      orderBy: asc(twitchCounters.name),
    });
  }),

  create: moderatorProcedure
    .input(z.object({ name: nameField }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const name = input.name.toLowerCase();

      const existing = await db.query.twitchCounters.findFirst({
        where: and(eq(twitchCounters.name, name), eq(twitchCounters.botChannelId, botChannel.id)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Counter "${name}" already exists.`,
        });
      }

      const [counter] = await db.insert(twitchCounters).values({
        name,
        botChannelId: botChannel.id,
      }).returning();

      await applyMutationEffects(ctx, {
        event: { name: "counter:updated", payload: { counterName: name, channelId: botChannel.id } },
        audit: { action: "counter.create", resourceType: "TwitchCounter", resourceId: counter!.id, metadata: { name } },
      });

      return counter!;
    }),

  update: moderatorProcedure
    .input(idInput.extend({ value: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const counter = await db.query.twitchCounters.findFirst({
        where: eq(twitchCounters.id, input.id),
      });

      assertOwnership(counter, botChannel, "Counter");

      const [updated] = await db.update(twitchCounters).set({ value: input.value }).where(eq(twitchCounters.id, input.id)).returning();

      await applyMutationEffects(ctx, {
        event: { name: "counter:updated", payload: { counterName: counter.name, channelId: botChannel.id } },
        audit: { action: "counter.update", resourceType: "TwitchCounter", resourceId: input.id, metadata: { name: counter.name, value: input.value } },
      });

      return updated;
    }),

  delete: moderatorProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const counter = await db.query.twitchCounters.findFirst({
        where: eq(twitchCounters.id, input.id),
      });

      assertOwnership(counter, botChannel, "Counter");

      await db.delete(twitchCounters).where(eq(twitchCounters.id, input.id));

      await applyMutationEffects(ctx, {
        event: { name: "counter:updated", payload: { counterName: counter.name, channelId: botChannel.id } },
        audit: { action: "counter.delete", resourceType: "TwitchCounter", resourceId: input.id, metadata: { name: counter.name } },
      });

      return { success: true };
    }),
});
