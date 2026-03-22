import { z } from "zod";

/** Reusable input for any mutation that targets a single entity by UUID. */
export const idInput = z.object({ id: z.string().uuid() });

/**
 * Name field used by counters, timers, and keywords.
 * Allows alphanumeric characters, underscores, and hyphens.
 */
export const nameField = z
  .string()
  .min(1)
  .max(50)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Name must be alphanumeric, underscore, or hyphen",
  );

/**
 * Name field used by chat commands.
 * Allows alphanumeric characters and underscores (no hyphens).
 */
export const commandNameField = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9_]+$/, "Name must be alphanumeric or underscore");

/** Twitch access level enum shared across commands, keywords, spam filters, etc. */
export const accessLevelEnum = z.enum([
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
]);

/** Response type enum for chat commands and keywords. */
export const responseTypeEnum = z.enum(["SAY", "MENTION", "REPLY"]);

/** Stream status enum for chat commands and keywords. */
export const streamStatusEnum = z.enum(["ONLINE", "OFFLINE", "BOTH"]);
