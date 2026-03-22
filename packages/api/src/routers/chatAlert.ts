import { db, eq, and, chatAlerts } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";
import { getUserBotChannel } from "../utils/botChannel";

const ALERT_TYPES = [
  "follow", "subscribe", "resubscribe", "gift_sub", "gift_sub_bomb",
  "raid", "cheer", "charity_donation", "hype_train_begin", "hype_train_end",
  "ad_break_begin", "stream_online", "stream_offline", "shoutout_received",
  "ban", "vip_add", "moderator_add",
] as const;

export const chatAlertRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);
    return db.query.chatAlerts.findMany({
      where: eq(chatAlerts.botChannelId, botChannel.id),
    });
  }),

  upsert: moderatorProcedure
    .input(
      z.object({
        alertType: z.enum(ALERT_TYPES),
        enabled: z.boolean().optional(),
        messageTemplates: z.array(z.string().min(1).max(500)).max(10).optional(),
        tierConfigs: z.record(z.string(), z.string().min(1).max(500)).optional(),
        minThreshold: z.number().int().min(1).max(100000).optional(),
        cooldownSeconds: z.number().int().min(0).max(86400).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const { alertType, ...fields } = input;

      const existing = await db.query.chatAlerts.findFirst({
        where: and(
          eq(chatAlerts.botChannelId, botChannel.id),
          eq(chatAlerts.alertType, alertType)
        ),
      });

      let result;
      if (existing) {
        const [updated] = await db
          .update(chatAlerts)
          .set(fields)
          .where(eq(chatAlerts.id, existing.id))
          .returning();
        result = updated!;
      } else {
        const [created] = await db
          .insert(chatAlerts)
          .values({ alertType, botChannelId: botChannel.id, ...fields })
          .returning();
        result = created!;
      }

      await applyMutationEffects(ctx, {
        event: { name: "alert:updated", payload: { channelId: botChannel.id } },
        audit: { action: fields.enabled !== undefined ? "alert.toggle" : "alert.update", resourceType: "ChatAlert", resourceId: result.id, metadata: { alertType } },
      });

      return result;
    }),

  toggleEnabled: moderatorProcedure
    .input(z.object({ alertType: z.enum(ALERT_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const existing = await db.query.chatAlerts.findFirst({
        where: and(
          eq(chatAlerts.botChannelId, botChannel.id),
          eq(chatAlerts.alertType, input.alertType)
        ),
      });

      let result;
      if (existing) {
        const [updated] = await db
          .update(chatAlerts)
          .set({ enabled: !existing.enabled })
          .where(eq(chatAlerts.id, existing.id))
          .returning();
        result = updated!;
      } else {
        // Create disabled-by-default with toggle → enabled
        const [created] = await db
          .insert(chatAlerts)
          .values({
            alertType: input.alertType,
            enabled: true,
            botChannelId: botChannel.id,
          })
          .returning();
        result = created!;
      }

      await applyMutationEffects(ctx, {
        event: { name: "alert:updated", payload: { channelId: botChannel.id } },
        audit: { action: "alert.toggle", resourceType: "ChatAlert", resourceId: result.id, metadata: { alertType: input.alertType, enabled: result.enabled } },
      });

      return result;
    }),
});
