import { z } from "zod";

export const TwitchUserIdSchema = z.string().regex(/^\d+$/, "Twitch user IDs are numeric strings");

export const DiscordSnowflakeSchema = z
  .string()
  .regex(/^\d{17,20}$/, "Discord snowflakes are 17-20 digit strings");

export const IsoDateSchema = z.string().datetime({ offset: true });

export const NonEmptyStringSchema = z.string().min(1);

export const Base64Schema = z.string().regex(/^[A-Za-z0-9+/=]+$/, "must be base64");
