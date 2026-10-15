import { z } from "zod";

export const coreInput = z.object({
  botName: z.string().trim().min(1).max(40),
  commandPrefix: z.string().min(1).max(5).regex(/^\S+$/),
  publicPageEnabled: z.boolean(),
  publicDescription: z.string().trim().max(280),
});
export const twitchInput = z.object({
  clientId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]{10,100}$/),
  clientSecret: z.string().trim().min(10).max(200).optional(),
});
export const discordInput = z.object({
  applicationId: z.string().regex(/^\d{17,20}$/),
  guildId: z.string().regex(/^\d{17,20}$/),
  token: z
    .string()
    .trim()
    .min(30)
    .max(200)
    .regex(/^\S+$/)
    .refine((s) => !s.startsWith("Bot "), "Paste the raw bot token")
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
