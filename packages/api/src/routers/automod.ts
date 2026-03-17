import { db, eq, automodSettings } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { logAudit } from "../utils/audit";
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

      const { eventBus } = await import("../events");
      await eventBus.publish("automod:settings-updated", { channelId: botChannel.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "automod.settings-update",
        resourceType: "AutomodSettings",
        resourceId: result!.id,
        metadata: { fields: Object.keys(input) },
      });

      return result!;
    }),

  approveHeldMessage: moderatorProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "automod.approve",
        resourceType: "AutomodHeldMessage",
        resourceId: input.messageId,
        metadata: {},
      });

      const { eventBus } = await import("../events");
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      await eventBus.publish("automod:resolved", {
        channelId: botChannel.id,
        messageId: input.messageId,
        action: "approved",
      });

      return { success: true };
    }),

  denyHeldMessage: moderatorProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "automod.deny",
        resourceType: "AutomodHeldMessage",
        resourceId: input.messageId,
        metadata: {},
      });

      const { eventBus } = await import("../events");
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      await eventBus.publish("automod:resolved", {
        channelId: botChannel.id,
        messageId: input.messageId,
        action: "denied",
      });

      return { success: true };
    }),
});
