import { db, eq, and, asc, desc, ilike, quotes } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";
import { getUserBotChannel, assertOwnership } from "../utils/botChannel";
import { idInput } from "../schemas/common";

export const quoteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.quotes.findMany({
      where: eq(quotes.botChannelId, botChannel.id),
      orderBy: asc(quotes.quoteNumber),
    });
  }),

  get: protectedProcedure
    .input(z.object({ quoteNumber: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const quote = await db.query.quotes.findFirst({
        where: and(
          eq(quotes.quoteNumber, input.quoteNumber),
          eq(quotes.botChannelId, botChannel.id),
        ),
      });

      if (!quote) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      }

      return quote;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      return db.query.quotes.findMany({
        where: and(
          eq(quotes.botChannelId, botChannel.id),
          ilike(quotes.text, `%${input.query}%`),
        ),
        orderBy: asc(quotes.quoteNumber),
      });
    }),

  add: moderatorProcedure
    .input(
      z.object({
        text: z.string().min(1).max(500),
        game: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      // Get next quote number
      const last = await db.query.quotes.findFirst({
        where: eq(quotes.botChannelId, botChannel.id),
        orderBy: desc(quotes.quoteNumber),
      });
      const quoteNumber = (last?.quoteNumber ?? 0) + 1;

      const [quote] = await db.insert(quotes).values({
        quoteNumber,
        text: input.text,
        game: input.game ?? null,
        addedBy: ctx.session.user.name,
        source: "web",
        botChannelId: botChannel.id,
      }).returning();

      await applyMutationEffects(ctx, {
        event: { name: "quote:created", payload: { quoteId: quote!.id } },
        audit: { action: "quote.add", resourceType: "Quote", resourceId: quote!.id, metadata: { quoteNumber, text: input.text } },
      });

      return quote!;
    }),

  remove: moderatorProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const quote = await db.query.quotes.findFirst({
        where: eq(quotes.id, input.id),
      });

      assertOwnership(quote, botChannel, "Quote");

      await db.delete(quotes).where(eq(quotes.id, input.id));

      await applyMutationEffects(ctx, {
        event: { name: "quote:deleted", payload: { quoteId: input.id } },
        audit: { action: "quote.remove", resourceType: "Quote", resourceId: input.id, metadata: { quoteNumber: quote.quoteNumber } },
      });

      return { success: true };
    }),
});
