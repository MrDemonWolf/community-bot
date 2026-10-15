import { TRPCError } from "@trpc/server";
import { encrypt } from "@community-bot/db/crypto";
import { disconnectOwnerTwitchConnection, getSettings, updateSettings } from "@community-bot/db/settings";
import { getRuntimes } from "@community-bot/db/runtime";
import { z } from "zod";

import { ownerProcedure, protectedProcedure, router } from "../index";
import { requireCapability } from "../access";
import {
  coreInput,
  discordInput,
  presenceInput,
  twitchInput,
} from "../validation";

async function toView(s: Awaited<ReturnType<typeof getSettings>>, owner = true) {
  return {
    setupComplete: s.setupComplete,
    botName: s.botName,
    commandPrefix: s.commandPrefix,
    channelName: s.channelName,
    publicPageEnabled: s.publicPageEnabled,
    publicDescription: s.publicDescription,
    twitchAppConfigured: Boolean(s.twitchClientId && s.twitchClientSecretEnc),
    twitchClientId: owner ? s.twitchClientId : null,
    broadcaster: {
      connected: Boolean(s.broadcasterTokenEnc),
      login: s.broadcasterLogin,
    },
    bot: { connected: Boolean(s.botTokenEnc), login: s.botLogin },
    twitchEnabled: s.twitchEnabled,
    twitchMuted: s.twitchMuted,
    discordConfigured: Boolean(s.discordTokenEnc),
    discordApplicationId: owner ? s.discordApplicationId : null,
    discordGuildId: owner ? s.discordGuildId : null,
    discordOAuthConfigured: Boolean(s.discordClientSecretEnc),
    discordEnabled: s.discordEnabled,
    discordStatus: s.discordStatus,
    discordActivityType: s.discordActivityType,
    discordActivityText: s.discordActivityText,
    discordActivityUrl: s.discordActivityUrl,
    runtimes: await getRuntimes(),
  };
}

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => toView(await getSettings(), ctx.access.owner)),
  updateCore: ownerProcedure
    .input(coreInput)
    .mutation(async ({ input }) => toView(await updateSettings(input))),
  configureTwitch: ownerProcedure
    .input(twitchInput)
    .mutation(async ({ input }) => {
      const s = await getSettings();
      if (!input.clientSecret && !s.twitchClientSecretEnc)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter the Twitch client secret.",
        });
      if (input.clientId !== s.twitchClientId && !input.clientSecret)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A new app needs its client secret.",
        });
      return toView(
        await updateSettings({
          twitchClientId: input.clientId,
          ...(input.clientSecret
            ? { twitchClientSecretEnc: encrypt(input.clientSecret) }
            : {}),
          ...(input.clientId !== s.twitchClientId
            ? {
                botUserId: null,
                botLogin: null,
                botTokenEnc: null,
                broadcasterUserId: null,
                broadcasterLogin: null,
                broadcasterTokenEnc: null,
                channelName: null,
                twitchEnabled: false,
              }
            : {}),
        }),
      );
    }),
  configureDiscord: ownerProcedure
    .input(discordInput.extend({ clientSecret: z.string().trim().min(10).max(200).optional() }))
    .mutation(async ({ input }) => {
      const s = await getSettings();
      if (!input.token && !s.discordTokenEnc)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter the bot token.",
        });
      return toView(
        await updateSettings({
          discordApplicationId: input.applicationId,
          discordGuildId: input.guildId,
          ...(input.token ? { discordTokenEnc: encrypt(input.token) } : {}),
          ...(input.clientSecret ? { discordClientSecretEnc: encrypt(input.clientSecret) } : {}),
        }),
      );
    }),
  updateDiscordPresence: protectedProcedure
    .input(presenceInput)
    .mutation(async ({ input, ctx }) => {
      requireCapability(ctx.access, "presence:manage", "discord");
      return toView(
        await updateSettings({
          discordStatus: input.status,
          discordActivityType: input.activityType,
          discordActivityText: input.activityText,
          discordActivityUrl:
            input.activityType === "streaming" ? input.activityUrl : null,
        }), ctx.access.owner,
      );
    }),
  control: protectedProcedure
    .input(
      z.object({
        service: z.enum(["discord", "twitch"]),
        action: z.enum(["join", "leave", "mute", "unmute"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      requireCapability(ctx.access, input.action === "mute" || input.action === "unmute" ? "bot:mute" : "bot:connect", input.service);
      const s = await getSettings();
      if (input.service === "discord") {
        if (input.action === "mute" || input.action === "unmute")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Discord only connects and displays presence. Use its status setting.",
          });
        if (
          input.action === "join" &&
          (!s.discordTokenEnc || !s.discordApplicationId || !s.discordGuildId)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Save Discord credentials first.",
          });
        return toView(
          await updateSettings({ discordEnabled: input.action === "join" }), ctx.access.owner,
        );
      }
      if (
        input.action === "join" &&
        (!s.botTokenEnc ||
          !s.broadcasterTokenEnc ||
          !s.twitchClientId ||
          !s.twitchClientSecretEnc)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connect both Twitch accounts first.",
        });
      }
      return toView(
        await updateSettings(
          input.action === "join" || input.action === "leave"
            ? { twitchEnabled: input.action === "join" }
            : { twitchMuted: input.action === "mute" },
        ), ctx.access.owner,
      );
    }),
  disconnectTwitch: ownerProcedure
    .input(z.object({ role: z.enum(["broadcaster", "bot"]) }))
    .mutation(async ({ input, ctx }) => {
      return toView(
        await disconnectOwnerTwitchConnection(ctx.session.user.id, input.role),
      );
    }),
  completeSetup: ownerProcedure.mutation(async () =>
    toView(await updateSettings({ setupComplete: true })),
  ),
});
