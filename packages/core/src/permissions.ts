export const PLATFORMS = ["twitch", "discord"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const ROLES = ["viewer", "subscriber", "vip", "moderator", "lead_moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const CAPABILITIES = [
  "dashboard:view", "bot:mute", "bot:connect", "presence:manage", "features:manage",
  "redemptions:view", "redemptions:manage", "integrations:manage", "access:manage", "workspace:manage",
  "command:public", "command:subscriber", "command:vip", "command:moderator", "command:lead_moderator", "command:admin",
] as const;
export type Capability = (typeof CAPABILITIES)[number];
export interface Grant { platform: Platform; role: Role; source: string; expiresAt?: string | null }
export interface Subject { owner: boolean; grants: Grant[] }

const moderator: Capability[] = ["dashboard:view", "bot:mute", "redemptions:view", "redemptions:manage", "command:moderator"];
const lead: Capability[] = [...moderator, "bot:connect", "command:lead_moderator"];
// Membership badges unlock commands only; dashboard access starts at a mapped staff role.
const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  viewer: [],
  subscriber: ["command:subscriber"],
  vip: ["command:vip"],
  moderator,
  lead_moderator: lead,
  admin: [...lead, "features:manage", "presence:manage", "command:admin"],
};

export function canAccess(subject: Subject, capability: Capability, platform?: Platform): boolean {
  if (subject.owner || capability === "command:public") return true;
  // A Twitch grant must never authorize a Discord action (or an unscoped staff action).
  if (!platform && capability !== "dashboard:view") return false;
  return subject.grants.some((grant) =>
    (!platform || grant.platform === platform) &&
    (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.now()) &&
    ROLE_CAPABILITIES[grant.role]?.includes(capability),
  );
}

export function capabilitiesFor(subject: Subject, platform: Platform): Capability[] {
  return CAPABILITIES.filter((capability) => canAccess(subject, capability, platform));
}

export function twitchBadgeRoles(badges: readonly { setId: string }[]): Role[] {
  const ids = new Set(badges.map((badge) => badge.setId));
  const roles: Role[] = ["viewer"];
  if (ids.has("subscriber")) roles.push("subscriber");
  if (ids.has("vip")) roles.push("vip");
  if (ids.has("moderator") || ids.has("lead_moderator")) roles.push("moderator");
  // A native lead badge is positive evidence for this message, not a persistent staff grant.
  if (ids.has("lead_moderator")) roles.push("lead_moderator");
  if (ids.has("broadcaster")) roles.push("admin");
  return roles;
}
