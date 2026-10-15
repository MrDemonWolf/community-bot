import { z } from "zod";
import type { Capability, Platform } from "./permissions";

export const featureConfigSchemas = {
  presence: z.object({}).strict(),
  uptime: z.object({ cooldownSeconds: z.number().int().min(1).max(300).default(3) }).strict(),
  "channel-points": z.object({}).strict(),
};
export type FeatureId = keyof typeof featureConfigSchemas;
export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  description: string;
  platforms: readonly Platform[];
  enabledByDefault: boolean;
  capability: Capability;
}
export const FEATURES: readonly FeatureDefinition[] = [
  { id: "presence", name: "Discord presence", description: "Show a configurable Discord status and activity.", platforms: ["discord"], enabledByDefault: true, capability: "presence:manage" },
  { id: "uptime", name: "Uptime commands", description: "Bot, server and stream uptime, with a public command list.", platforms: ["twitch", "discord"], enabledByDefault: true, capability: "features:manage" },
  { id: "channel-points", name: "Channel Point redeems", description: "Create rewards, send a chat response and manage the redemption queue.", platforms: ["twitch"], enabledByDefault: false, capability: "features:manage" },
];
export interface FeatureState { featureId: string; enabled: boolean; config: unknown }
export function featureEnabled(id: FeatureId, states: readonly FeatureState[], platform: Platform): boolean {
  const definition = FEATURES.find((feature) => feature.id === id)!;
  return definition.platforms.includes(platform) && (states.find((state) => state.featureId === `${platform}.${id}`)?.enabled ?? definition.enabledByDefault);
}
export function featureConfig(id: FeatureId, states: readonly FeatureState[], platform: Platform) {
  return featureConfigSchemas[id].parse(states.find((state) => state.featureId === `${platform}.${id}`)?.config ?? {});
}
export const TWITCH_BOT_SCOPES = ["user:read:chat", "user:write:chat"] as const;
export function twitchCreatorScopes(settings: { channelPointsEnabled: boolean; permissionSyncTwitch: boolean }): string[] {
  return [
    ...(settings.channelPointsEnabled ? ["channel:manage:redemptions"] : []),
    ...(settings.permissionSyncTwitch ? ["moderation:read", "channel:read:vips", "channel:read:subscriptions"] : []),
  ];
}
