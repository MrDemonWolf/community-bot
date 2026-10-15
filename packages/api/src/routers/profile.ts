import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getPlatformIdentities, replacePlatformIdentityToken } from "@community-bot/db/features";
import { getPersonalProfile, profilePicture, selectPersonalProfile } from "@community-bot/db/profile";
import { getSettings } from "@community-bot/db/settings";
import { protectedProcedure, router } from "../index";
import { usableToken } from "../access";
import { boundedFetch, decodeCroppedPng, discordAvatarUrl, sanitizeProfileImage, twitchAvatarUrl } from "../profile-image";

async function view(user: { id: string; name: string }) {
  const [profile, identities, settings] = await Promise.all([getPersonalProfile(user.id), getPlatformIdentities(user.id), getSettings()]);
  return { ...profilePicture(profile), name: user.name,
    choices: (["default", "twitch", "discord", "custom"] as const).map((source) => ({ source,
      available: source === "default" || source === "custom" && profile.images.some((image) => image.source === "custom")
        || source === "twitch" && Boolean(identities.some((identity) => identity.provider === "twitch") && settings.twitchClientId && settings.twitchClientSecretEnc)
        || source === "discord" && Boolean(identities.some((identity) => identity.provider === "discord") && settings.discordApplicationId && settings.discordClientSecretEnc),
      hasImage: source === "default" || profile.images.some((image) => image.source === source),
    })),
  };
}

async function providerImage(userId: string, source: "twitch" | "discord") {
  const [settings, identities] = await Promise.all([getSettings(), getPlatformIdentities(userId)]);
  const identity = identities.find((row) => row.provider === source);
  if (!identity) throw new TRPCError({ code: "BAD_REQUEST", message: `Link your own ${source === "discord" ? "Discord" : "Twitch"} account on My access first.` });
  const clientId = source === "discord" ? settings.discordApplicationId : settings.twitchClientId;
  const secretEnc = source === "discord" ? settings.discordClientSecretEnc : settings.twitchClientSecretEnc;
  if (!clientId || !secretEnc) throw new TRPCError({ code: "BAD_REQUEST", message: "The creator needs to configure this platform's application first." });
  const token = await usableToken(source, identity.tokenEnc, clientId, secretEnc,
    (expected, next) => replacePlatformIdentityToken(identity.id, expected, next));
  let url: string;
  if (source === "discord") {
    const user = JSON.parse((await boundedFetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token.accessToken}` } })).toString()) as { id: string; avatar: string | null; discriminator?: string };
    if (user.id !== identity.providerUserId) throw new Error("Linked Discord identity changed.");
    url = discordAvatarUrl(user);
  } else {
    const users = JSON.parse((await boundedFetch("https://api.twitch.tv/helix/users", { headers: { "Client-Id": clientId, Authorization: `Bearer ${token.accessToken}` } })).toString()) as { data?: { id: string; profile_image_url: string }[] };
    const user = users.data?.[0];
    if (user?.id !== identity.providerUserId) throw new Error("Linked Twitch identity changed.");
    url = twitchAvatarUrl(user.profile_image_url);
  }
  return sanitizeProfileImage(await boundedFetch(url, {}, 5 * 1024 * 1024));
}

export const profileRouter = router({
  get: protectedProcedure.query(({ ctx }) => view(ctx.session.user)),
  select: protectedProcedure.input(z.object({ source: z.enum(["default", "twitch", "discord", "custom"]) })).mutation(async ({ input, ctx }) => {
    let image: Buffer | undefined;
    if (input.source === "twitch" || input.source === "discord") {
      try { image = await providerImage(ctx.session.user.id, input.source); }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not copy your profile image. Check your linked account and try again." }); }
    }
    if (!await selectPersonalProfile(ctx.session.user.id, input.source, image)) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload your custom image first." });
    return view(ctx.session.user);
  }),
  upload: protectedProcedure.input(z.object({ pngBase64: z.string().min(1).max(699052) })).mutation(async ({ input, ctx }) => {
    let image: Buffer;
    try { image = await sanitizeProfileImage(decodeCroppedPng(input.pngBase64), true); }
    catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Use the cropper to upload a square PNG no larger than 512 pixels and 512 KB." }); }
    await selectPersonalProfile(ctx.session.user.id, "custom", image);
    return view(ctx.session.user);
  }),
});
