import { db, eq, automodSettings } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { applyMutationEffects } from "../utils/mutation";
import { getUserBotChannel } from "../utils/botChannel";

export const automodRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    const settings = await db.query.automodSettings.findFirst({
      where: eq(automodSettings.botChannelId, botChannel.id),
    });

    return settings ?? {
      automodEnabled: false,
      automodAction: "notify" as const,
      suspiciousUserEnabled: false,
      suspiciousUserAction: "notify" as const,
    };
  }),

  update: moderatorProcedure
    .input(
      z.object({
        automodEnabled: z.boolean().optional(),
        automodAction: z.enum(["notify", "auto_approve", "auto_deny"]).optional(),
        suspiciousUserEnabled: z.boolean().optional(),
        suspiciousUserAction: z.enum(["notify", "restrict", "ban"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const [result] = await db
        .insert(automodSettings)
        .values({ botChannelId: botChannel.id, ...input })
        .onConflictDoUpdate({
          target: automodSettings.botChannelId,
          set: input,
        })
        .returning();

      await applyMutationEffects(ctx, {
        event: { name: "automod:settings-updated", payload: { channelId: botChannel.id } },
        audit: { action: "automod.settings-update", resourceType: "AutomodSettings", resourceId: result!.id, metadata: { fields: Object.keys(input) } },
      });

      return result!;
    }),

  approveHeldMessage: moderatorProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      await applyMutationEffects(ctx, {
        event: { name: "automod:resolved", payload: { channelId: botChannel.id, messageId: input.messageId, action: "approved" } },
        audit: { action: "automod.approve", resourceType: "AutomodHeldMessage", resourceId: input.messageId, metadata: {} },
      });

      return { success: true };
    }),

  denyHeldMessage: moderatorProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      await applyMutationEffects(ctx, {
        event: { name: "automod:resolved", payload: { channelId: botChannel.id, messageId: input.messageId, action: "denied" } },
        audit: { action: "automod.deny", resourceType: "AutomodHeldMessage", resourceId: input.messageId, metadata: {} },
      });

      return { success: true };
    }),
});
