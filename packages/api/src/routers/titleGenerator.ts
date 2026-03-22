import {
  db,
  eq,
  botChannels,
  titleGeneratorSettings,
} from "@community-bot/db";
import { env } from "@community-bot/env/server";
import { leadModProcedure, router } from "../index";
import { z } from "zod";
import { applyMutationEffects } from "../utils/mutation";
import { generateTitles } from "../utils/geminiTitles";
import { getChannelInfo, patchTwitchChannel } from "../utils/twitch";

export const titleGeneratorRouter = router({
  /** Get saved branding prompt for the current user's channel */
  getSettings: leadModProcedure.query(async ({ ctx }) => {
    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.userId, ctx.session.user.id),
    });

    if (!botChannel) return { brandingPrompt: "" };

    const settings = await db.query.titleGeneratorSettings.findFirst({
      where: eq(titleGeneratorSettings.botChannelId, botChannel.id),
    });

    return { brandingPrompt: settings?.brandingPrompt ?? "" };
  }),

  /** Save branding prompt */
  updateSettings: leadModProcedure
    .input(z.object({ brandingPrompt: z.string().max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, ctx.session.user.id),
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      await db
        .insert(titleGeneratorSettings)
        .values({
          botChannelId: botChannel.id,
          brandingPrompt: input.brandingPrompt,
        })
        .onConflictDoUpdate({
          target: titleGeneratorSettings.botChannelId,
          set: { brandingPrompt: input.brandingPrompt },
        });

      await applyMutationEffects(ctx, {
        audit: { action: "title-generator.settings-update", resourceType: "TitleGeneratorSettings", resourceId: botChannel.id, metadata: { brandingPromptLength: input.brandingPrompt.length } },
      });

      return { success: true };
    }),

  /** Generate 3 title suggestions via Gemini */
  generate: leadModProcedure
    .input(z.object({ context: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not configured. AI title generation is unavailable."
        );
      }

      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, ctx.session.user.id),
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      // Load branding prompt
      const settings = await db.query.titleGeneratorSettings.findFirst({
        where: eq(titleGeneratorSettings.botChannelId, botChannel.id),
      });

      // Get current channel info from Twitch
      const channelInfo = await getChannelInfo(botChannel.twitchUserId);

      const result = await generateTitles(apiKey, botChannel.id, {
        currentTitle: channelInfo?.title ?? "",
        currentGame: channelInfo?.game_name ?? "",
        brandingPrompt: settings?.brandingPrompt ?? "",
        userContext: input.context,
      });

      await applyMutationEffects(ctx, {
        audit: { action: "title-generator.generate", resourceType: "TitleGeneratorSettings", resourceId: botChannel.id, metadata: { titleCount: result.titles.length } },
      });

      return {
        titles: result.titles,
        currentTitle: channelInfo?.title ?? "",
        currentGame: channelInfo?.game_name ?? "",
      };
    }),

  /** Set a title on Twitch via Helix API */
  setTitle: leadModProcedure
    .input(z.object({ title: z.string().min(1).max(140) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await db.query.botChannels.findFirst({
        where: eq(botChannels.userId, ctx.session.user.id),
      });

      if (!botChannel || !botChannel.enabled) {
        throw new Error("Bot is not enabled for your channel.");
      }

      await patchTwitchChannel(botChannel.twitchUserId, {
        title: input.title,
      });

      await applyMutationEffects(ctx, {
        audit: { action: "title-generator.set-title", resourceType: "TitleGeneratorSettings", resourceId: botChannel.id, metadata: { title: input.title } },
      });

      return { success: true };
    }),
});
