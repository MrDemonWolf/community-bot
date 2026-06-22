import { encrypt } from "@community-bot/db/crypto";
import { getSettings, updateSettings } from "@community-bot/db/settings";
import { env } from "@community-bot/env/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

/** Secret-free projection sent to the dashboard. */
function toView(s: Awaited<ReturnType<typeof getSettings>>) {
  return {
    setupComplete: s.setupComplete,
    commandPrefix: s.commandPrefix,
    timezone: s.timezone,
    channelName: s.channelName,
    twitchAppConfigured: Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET),
    broadcaster: {
      connected: Boolean(s.broadcasterTokenEnc),
      login: s.broadcasterLogin,
    },
    bot: {
      connected: Boolean(s.botTokenEnc),
      login: s.botLogin,
    },
    discordConfigured: Boolean(s.discordTokenEnc),
    discordGuildId: s.discordGuildId,
    geminiConfigured: Boolean(s.geminiKeyEnc),
    weatherkitConfigured: Boolean(s.weatherkitP8Enc),
  };
}

export const settingsRouter = router({
  get: protectedProcedure.query(async () => toView(await getSettings())),

  updateCore: protectedProcedure
    .input(
      z.object({
        commandPrefix: z.string().min(1).max(5),
        timezone: z.string().min(1),
        channelName: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ input }) => toView(await updateSettings(input))),

  // Optional integrations. Empty string clears; undefined leaves unchanged.
  updateOptional: protectedProcedure
    .input(
      z.object({
        discordToken: z.string().optional(),
        discordGuildId: z.string().optional(),
        geminiKey: z.string().optional(),
        weatherkitKeyId: z.string().optional(),
        weatherkitTeamId: z.string().optional(),
        weatherkitP8: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const patch: Record<string, string | null> = {};
      const setSecret = (val: string | undefined, col: string) => {
        if (val === undefined) return;
        patch[col] = val === "" ? null : encrypt(val);
      };
      const setPlain = (val: string | undefined, col: string) => {
        if (val === undefined) return;
        patch[col] = val === "" ? null : val;
      };
      setSecret(input.discordToken, "discordTokenEnc");
      setPlain(input.discordGuildId, "discordGuildId");
      setSecret(input.geminiKey, "geminiKeyEnc");
      setPlain(input.weatherkitKeyId, "weatherkitKeyId");
      setPlain(input.weatherkitTeamId, "weatherkitTeamId");
      setSecret(input.weatherkitP8, "weatherkitP8Enc");
      return toView(await updateSettings(patch));
    }),

  disconnectTwitch: protectedProcedure
    .input(z.object({ role: z.enum(["broadcaster", "bot"]) }))
    .mutation(async ({ input }) => {
      const patch =
        input.role === "broadcaster"
          ? { broadcasterUserId: null, broadcasterLogin: null, broadcasterTokenEnc: null }
          : { botUserId: null, botLogin: null, botTokenEnc: null };
      return toView(await updateSettings(patch));
    }),

  completeSetup: protectedProcedure.mutation(async () => {
    return toView(await updateSettings({ setupComplete: true }));
  }),
});
