import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { FEATURES, featureConfig, featureConfigSchemas, featureEnabled } from "@community-bot/core/features";
import { canAccess } from "@community-bot/core/permissions";
import { getFeatureConfigs, setFeatureConfig } from "@community-bot/db/features";
import { getSettings } from "@community-bot/db/settings";
import { protectedProcedure, router } from "../index";

export const featuresRouter = router({
  list: protectedProcedure.query(async () => {
    const states = await getFeatureConfigs();
    return FEATURES.flatMap((feature) => feature.platforms.map((platform) => ({
      ...feature, platform, enabled: featureEnabled(feature.id, states, platform), config: featureConfig(feature.id, states, platform),
    })));
  }),
  update: protectedProcedure.input(z.object({
    featureId: z.enum(["presence", "uptime", "channel-points"]),
    platform: z.enum(["twitch", "discord"]), enabled: z.boolean(), config: z.unknown().optional(),
  }).strict()).mutation(async ({ ctx, input }) => {
    const feature = FEATURES.find((item) => item.id === input.featureId)!;
    if (!feature.platforms.includes(input.platform) || !canAccess(ctx.access, feature.capability, input.platform))
      throw new TRPCError({ code: "FORBIDDEN", message: "You cannot manage this feature on this platform." });
    if (input.featureId === "channel-points" && input.enabled && !(await getSettings()).channelPointsEnabled)
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The creator must enable Channel Points and authorize Twitch in Rewards first." });
    const parsed = input.config === undefined ? undefined : featureConfigSchemas[input.featureId].safeParse(input.config);
    if (parsed && !parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: "Feature configuration is invalid." });
    const config = parsed?.data;
    return setFeatureConfig(`${input.platform}.${input.featureId}`, { enabled: input.enabled, ...(config === undefined ? {} : { config }) });
  }),
});
