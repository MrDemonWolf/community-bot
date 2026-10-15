import { z } from "zod";

export const coreInput = z.object({
  botName: z.string().trim().min(1, "Enter a display name.").max(40, "Use 40 characters or fewer."),
  commandPrefix: z.string().min(1, "Enter a prefix, such as !.").max(5, "Use 1–5 characters with no spaces.").regex(/^\S+$/, "Use 1–5 characters with no spaces."),
  publicPageEnabled: z.boolean(),
  publicDescription: z.string().trim().max(280, "Use 280 characters or fewer."),
});
export const twitchInput = z.object({
  clientId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]{10,100}$/, "Copy the 10–100 letter and number client ID from your Twitch developer application."),
  clientSecret: z.string().trim().min(10, "Paste the complete client secret from your Twitch developer application.").max(200, "Use a client secret of 200 characters or fewer.").optional(),
});
export const discordInput = z.object({
  applicationId: z.string().regex(/^\d{17,20}$/, "Enter the 17–20 digit application ID from the Discord developer portal."),
  guildId: z.string().regex(/^\d{17,20}$/, "Enter a 17–20 digit server ID. Enable Discord Developer Mode to copy it."),
  token: z
    .string()
    .trim()
    .min(30, "Paste the complete raw bot token from the Discord developer portal.")
    .max(200, "Paste only the raw bot token, without the Bot prefix.")
    .refine((s) => !s.startsWith("Bot "), "Paste only the raw bot token, without the Bot prefix.")
    .regex(/^\S+$/, "Paste only the raw bot token, with no spaces or Bot prefix.")
    .optional(),
});
export const presenceInput = z
  .object({
    status: z.enum(["online", "idle", "dnd", "invisible"]),
    activityType: z.enum([
      "playing",
      "listening",
      "watching",
      "competing",
      "custom",
      "streaming",
    ]),
    activityText: z.string().trim().max(128),
    activityUrl: z.string().max(500).optional(),
  })
  .refine(
    (s) => {
      if (s.activityType !== "streaming") return true;
      try {
        const u = new URL(s.activityUrl ?? "");
        return (
          u.protocol === "https:" &&
          [
            "twitch.tv",
            "www.twitch.tv",
            "youtube.com",
            "www.youtube.com",
          ].includes(u.hostname) &&
          !u.username &&
          !u.password &&
          !u.port
        );
      } catch {
        return false;
      }
    },
    {
      message: "Streaming requires an HTTPS Twitch or YouTube URL",
      path: ["activityUrl"],
    },
  );
