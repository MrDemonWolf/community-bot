import { prisma } from "@community-bot/db";
import { moderatorProcedure, protectedProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function getUserBotChannel(userId: string) {
  const botChannel = await prisma.botChannel.findUnique({
    where: { userId },
  });

  if (!botChannel || !botChannel.enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Bot is not enabled for your channel.",
    });
  }

  return botChannel;
}

export const spamFilterRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const filter = await prisma.spamFilter.findUnique({
      where: { botChannelId: botChannel.id },
    });

    // Return defaults if no filter config exists yet
    return filter ?? {
      capsEnabled: false,
      capsMinLength: 15,
      capsMaxPercent: 70,
      linksEnabled: false,
      linksAllowSubs: true,
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
        symbolsEnabled: z.boolean().optional(),
        symbolsMaxPercent: z.number().int().min(1).max(100).optional(),
        emotesEnabled: z.boolean().optional(),
        emotesMaxCount: z.number().int().min(1).max(100).optional(),
        repetitionEnabled: z.boolean().optional(),
        repetitionMaxRepeat: z.number().int().min(2).max(100).optional(),
        bannedWordsEnabled: z.boolean().optional(),
        bannedWords: z.array(z.string().min(1).max(100)).max(500).optional(),
        exemptLevel: z.enum([
          "EVERYONE",
          "SUBSCRIBER",
          "REGULAR",
          "VIP",
          "MODERATOR",
          "LEAD_MODERATOR",
          "BROADCASTER",
        ]).optional(),
        timeoutDuration: z.number().int().min(1).max(86400).optional(),
        warningMessage: z.string().min(1).max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const result = await prisma.spamFilter.upsert({
        where: { botChannelId: botChannel.id },
        create: {
          botChannelId: botChannel.id,
          ...input,
        },
        update: input,
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("spam-filter:updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "spam-filter.update",
        resourceType: "SpamFilter",
        resourceId: result.id,
        metadata: { filters: Object.keys(input) },
      });

      return result;
    }),
});
