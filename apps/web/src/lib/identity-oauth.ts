import { createHash } from "node:crypto";
import type { Platform } from "@community-bot/core/permissions";
import { getSettings } from "@community-bot/db/settings";

export function identityProvider(value: string): Platform | null {
  return value === "twitch" || value === "discord" ? value : null;
}

export function identityApp(provider: Platform, settings: Awaited<ReturnType<typeof getSettings>>) {
  const clientId = provider === "twitch" ? settings.twitchClientId : settings.discordApplicationId;
  const secretEnc = provider === "twitch" ? settings.twitchClientSecretEnc : settings.discordClientSecretEnc;
  if (!clientId || !secretEnc || (provider === "discord" && !settings.discordGuildId)) return null;
  const version = createHash("sha256").update(secretEnc + (provider === "discord" ? settings.discordGuildId : "")).digest("hex");
  return { clientId, secretEnc, version, guildId: provider === "discord" ? settings.discordGuildId ?? undefined : undefined };
}
