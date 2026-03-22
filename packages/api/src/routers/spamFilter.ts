import { db, eq, spamFilters } from "@community-bot/db";
import { moderatorProcedure, protectedProcedure, router } from "../index";
import { z } from "zod";
import { applyMutationEffects } from "../utils/mutation";
import { getUserBotChannel } from "../utils/botChannel";
import { accessLevelEnum } from "../schemas/common";

export const spamFilterRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const filter = await db.query.spamFilters.findFirst({
      where: eq(spamFilters.botChannelId, botChannel.id),
    });

    // Return defaults if no filter config exists yet
    return filter ?? {
      capsEnabled: false,
      capsMinLength: 15,
      capsMaxPercent: 70,
      linksEnabled: false,
      linksAllowSubs: true,
      linksAllowlist: [] as string[],
      symbolsEnabled: false,
      symbolsMaxPercent: 50,
      emotesEnabled: false,
      emotesMaxCount: 15,
      repetitionEnabled: false,
      repetitionMaxRepeat: 10,
      bannedWordsEnabled: false,
      bannedWords: [] as string[],
      exemptLevel: "SUBSCRIBER",
      timeoutDuration: 5,
      warningMessage: "Please don't spam.",
    };
  }),

  update: moderatorProcedure
    .input(
      z.object({
        capsEnabled: z.boolean().optional(),
        capsMinLength: z.number().int().min(1).max(500).optional(),
        capsMaxPercent: z.number().int().min(1).max(100).optional(),
        linksEnabled: z.boolean().optional(),
        linksAllowSubs: z.boolean().optional(),
        linksAllowlist: z.array(z.string().min(1).max(200)).max(100).optional(),
        symbolsEnabled: z.boolean().optional(),
        symbolsMaxPercent: z.number().int().min(1).max(100).optional(),
        emotesEnabled: z.boolean().optional(),
        emotesMaxCount: z.number().int().min(1).max(100).optional(),
        repetitionEnabled: z.boolean().optional(),
        repetitionMaxRepeat: z.number().int().min(2).max(100).optional(),
        bannedWordsEnabled: z.boolean().optional(),
        bannedWords: z.array(z.string().min(1).max(100)).max(500).optional(),
        exemptLevel: accessLevelEnum.optional(),
        timeoutDuration: z.number().int().min(1).max(86400).optional(),
        warningMessage: z.string().min(1).max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const [result] = await db.insert(spamFilters).values({
        botChannelId: botChannel.id,
        ...input,
      }).onConflictDoUpdate({
        target: spamFilters.botChannelId,
        set: input,
      }).returning();

      await applyMutationEffects(ctx, {
        event: { name: "spam-filter:updated", payload: { channelId: botChannel.id } },
        audit: { action: "spam-filter.update", resourceType: "SpamFilter", resourceId: result!.id, metadata: { filters: Object.keys(input) } },
      });

      return result!;
    }),
});
