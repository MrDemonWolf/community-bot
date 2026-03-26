/**
 * Shared formatting utilities for enum display values.
 */

/** Format any UPPER_SNAKE_CASE enum value to Title Case (e.g. "LEAD_MODERATOR" → "Lead Moderator"). */
export function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Format access level enums for display. Alias for formatLabel. */
export const formatAccessLevel = formatLabel;

/** All Twitch access level enum values in order of privilege. */
export const ACCESS_LEVELS = [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
] as const;

/** All Twitch response type enum values. */
export const RESPONSE_TYPES = ["SAY", "MENTION", "REPLY"] as const;

/** All Twitch stream status enum values (matches DB enum order). */
export const STREAM_STATUSES = ["ONLINE", "OFFLINE", "BOTH"] as const;

/** Semantic color classes for access level badges. */
export function accessLevelColor(level: string): string {
  const colors: Record<string, string> = {
    EVERYONE: "bg-green-500/10 text-green-600 dark:text-green-400",
    SUBSCRIBER: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    REGULAR: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    VIP: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    MODERATOR: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    LEAD_MODERATOR: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    BROADCASTER: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return colors[level] ?? "bg-muted text-muted-foreground";
}
