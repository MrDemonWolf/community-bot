/**
 * Alert Template Engine — Substitutes event-specific variables in alert message templates.
 *
 * Each alert type has its own variable map. Variables use {variableName} syntax.
 * A random template is selected from the configured array on each fire.
 */

export type AlertType =
  | "follow"
  | "subscribe"
  | "resubscribe"
  | "gift_sub"
  | "gift_sub_bomb"
  | "raid"
  | "cheer"
  | "charity_donation"
  | "hype_train_begin"
  | "hype_train_end"
  | "ad_break_begin"
  | "stream_online"
  | "stream_offline"
  | "shoutout_received"
  | "ban"
  | "vip_add"
  | "moderator_add";

export interface AlertContext {
  username?: string;
  displayName?: string;
  months?: number;
  tier?: string;
  giftCount?: number;
  viewerCount?: number;
  bits?: number;
  amount?: number;
  currency?: string;
  charity?: string;
  duration?: number;
  level?: number;
  total?: number;
  fromChannel?: string;
  message?: string;
}

/** Pick a random element from a non-empty array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function substitute(template: string, ctx: AlertContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = (ctx as Record<string, unknown>)[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

/**
 * Returns a formatted alert message for the given type, picking a random
 * template and substituting context variables.
 *
 * @param templates  Array of template strings (from DB config)
 * @param tierConfigs  Optional tier-specific overrides { "1": "...", "2": "...", "3": "..." }
 * @param alertType  The alert type
 * @param ctx  Event context variables
 */
export function renderAlertMessage(
  templates: string[],
  tierConfigs: Record<string, string> | null | undefined,
  alertType: AlertType,
  ctx: AlertContext
): string | null {
  // Tier-specific override takes precedence for subscribes
  if (
    tierConfigs &&
    ctx.tier &&
    (alertType === "subscribe" || alertType === "resubscribe" || alertType === "gift_sub")
  ) {
    const tierTemplate = tierConfigs[ctx.tier];
    if (tierTemplate) return substitute(tierTemplate, ctx);
  }

  if (templates.length === 0) return null;
  const template = pick(templates);
  return substitute(template, ctx);
}

/**
 * Default template suggestions per alert type (used when no config exists).
 */
export const DEFAULT_TEMPLATES: Record<AlertType, string[]> = {
  follow: ["{username} just followed! Welcome to the community! 🎉"],
  subscribe: ["{username} just subscribed at Tier {tier}! Thank you! 🎉"],
  resubscribe: ["{username} has been subscribed for {months} months! Thank you! ❤️"],
  gift_sub: ["{username} gifted a sub to the channel! 🎁"],
  gift_sub_bomb: ["{username} gifted {giftCount} subs to the community! 🎁🎁🎁"],
  raid: ["{username} raided with {viewerCount} viewers! Welcome everyone! 🎊"],
  cheer: ["{username} cheered {bits} bits! PogChamp"],
  charity_donation: ["{username} donated {amount} {currency} to {charity}! ❤️"],
  hype_train_begin: ["A Hype Train has started! Let's go! 🚂"],
  hype_train_end: ["The Hype Train reached level {level}! Thanks everyone! 🚂💨"],
  ad_break_begin: ["⚠️ An ad break is starting for {duration} seconds."],
  stream_online: ["Stream is now live! Welcome everyone! 👋"],
  stream_offline: ["Stream has ended. Thanks for watching! 💙"],
  shoutout_received: ["Shoutout received from {fromChannel}! Go check them out!"],
  ban: ["{username} has been banned from the channel."],
  vip_add: ["{username} has been added as a VIP! ⭐"],
  moderator_add: ["{username} has been added as a moderator! 🛡️"],
};
