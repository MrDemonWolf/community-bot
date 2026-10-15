import { isOwner } from "@community-bot/auth";
import { canAccess, capabilitiesFor, type Capability, type Grant, type Platform, type Role, type Subject } from "@community-bot/core/permissions";
import { decrypt } from "@community-bot/db/crypto";
import { getPermissionMappings, getPlatformIdentities, replacePlatformIdentityToken } from "@community-bot/db/features";
import { getSettings } from "@community-bot/db/settings";
import { getCreatorClient } from "@community-bot/twitch";
import { decodeToken, encodeToken, type StoredTwitchToken } from "@community-bot/db/twitch";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

type Identity = Awaited<ReturnType<typeof getPlatformIdentities>>[number];
type Settings = Awaited<ReturnType<typeof getSettings>>;
type Mapping = Awaited<ReturnType<typeof getPermissionMappings>>[number];
type Sync = { state: string; checkedAt: string | null };
type Evidence = { grants: Grant[]; sync: { twitch: Sync; discord: Sync } };
const cache = new Map<string, { key: string; until: number; value: Promise<Evidence> }>();
const refreshes = new Map<string, Promise<StoredTwitchToken>>();
const rateLimits = new Map<string, number>();
const userRows = z.object({ data: z.array(z.object({ id: z.string() })) });
const roleRows = z.object({ data: z.array(z.object({ user_id: z.string() })) });
const memberSchema = z.object({ roles: z.array(z.string()), pending: z.boolean().optional() });

async function remote(url: string, headers: Record<string, string>) {
  const key = url + headers.Authorization;
  if ((rateLimits.get(key) ?? 0) > Date.now()) throw new Error("rate_limited");
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (response.status === 429) {
    const retry = Number(response.headers.get("Retry-After"));
    const reset = Number(response.headers.get("Ratelimit-Reset")) * 1000 - Date.now();
    rateLimits.set(key, Date.now() + Math.max(1000, Number.isFinite(retry) ? retry * 1000 : 0, Number.isFinite(reset) ? reset : 0));
  }
  if (!response.ok) throw new Error(response.status === 429 ? "rate_limited" : response.status === 401 || response.status === 403 ? "reconnect" : "unavailable");
  return response.json();
}

export async function usableToken(provider: Platform, encrypted: string, clientId: string, secretEnc: string,
  save: (expected: string, next: string) => Promise<boolean>): Promise<StoredTwitchToken> {
  const token = decodeToken(encrypted);
  if ((token as StoredTwitchToken & { clientId?: string }).clientId !== clientId) throw new Error("reconnect");
  if (token.expiresIn !== null && token.obtainmentTimestamp + token.expiresIn * 1000 > Date.now() + 60000) return token;
  if (!token.refreshToken) throw new Error("reconnect");
  const existing = refreshes.get(encrypted);
  if (existing) return existing;
  const work = (async () => {
    // Share in-flight refreshes because providers may rotate refresh tokens; CAS still guards unlink/relink.
    const response = await fetch(provider === "twitch" ? "https://id.twitch.tv/oauth2/token" : "https://discord.com/api/v10/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refreshToken!, client_id: clientId, client_secret: decrypt(secretEnc) }),
    });
    if (!response.ok) throw new Error("reconnect");
    const data = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(),
      expires_in: z.number().positive(), scope: z.union([z.string(), z.array(z.string())]).optional() }).parse(await response.json());
    const updated = { clientId, accessToken: data.access_token, refreshToken: data.refresh_token ?? token.refreshToken,
      expiresIn: data.expires_in, obtainmentTimestamp: Date.now(),
      scope: typeof data.scope === "string" ? data.scope.split(" ") : data.scope ?? token.scope };
    if (!await save(encrypted, encodeToken(updated))) throw new Error("reconnect");
    return updated;
  })();
  refreshes.set(encrypted, work);
  try { return await work; } finally { refreshes.delete(encrypted); }
}

function mappedGrants(provider: Platform, roles: string[], mappings: Mapping[], expiresAt: string): Grant[] {
  return mappings.filter((mapping) => mapping.provider === provider && roles.includes(mapping.sourceRoleId))
    .flatMap((mapping) => mapping.scopes.filter((scope): scope is Platform => scope === "twitch" || scope === "discord")
      .map((platform) => ({ platform, role: mapping.role as Role, source: `${provider}:${mapping.sourceRoleId}`, expiresAt })));
}

async function twitchRoles(identity: Identity, settings: Settings, mappings: Mapping[]) {
  if (!settings.twitchClientId || !settings.twitchClientSecretEnc || !settings.broadcasterUserId || !settings.broadcasterTokenEnc) throw new Error("configure");
  const own = await usableToken("twitch", identity.tokenEnc, settings.twitchClientId, settings.twitchClientSecretEnc,
    (old, next) => replacePlatformIdentityToken(identity.id, old, next));
  const ownUser = userRows.parse(await remote("https://api.twitch.tv/helix/users", {
    Authorization: `Bearer ${own.accessToken}`, "Client-Id": settings.twitchClientId,
  })).data[0];
  if (ownUser?.id !== identity.providerUserId) throw new Error("reconnect");
  const creatorClient = await getCreatorClient(settings);
  const creator = await creatorClient.auth.getAccessTokenForUser(creatorClient.userId);
  if (!creator) throw new Error("reconnect");
  const needed = new Set(mappings.filter((mapping) => mapping.provider === "twitch").map((mapping) => mapping.sourceRoleId));
  const roles: string[] = [];
  for (const [role, path, scope] of [
    ["moderator", "moderation/moderators", "moderation:read"],
    ["vip", "channels/vips", "channel:read:vips"],
    ["subscriber", "subscriptions", "channel:read:subscriptions"],
  ] as const) {
    if (!needed.has(role) && !(role === "moderator" && needed.has("lead_moderator"))) continue;
    if (!creator.scope.includes(scope)) throw new Error("reconnect");
    const url = new URL("https://api.twitch.tv/helix/" + path);
    url.searchParams.set("broadcaster_id", settings.broadcasterUserId);
    url.searchParams.set("user_id", identity.providerUserId);
    const response = roleRows.parse(await remote(url.toString(), { Authorization: `Bearer ${creator.accessToken}`, "Client-Id": settings.twitchClientId }));
    if (response.data.some((row) => row.user_id === identity.providerUserId)) roles.push(role);
  }
  if (roles.includes("moderator") && settings.twitchLeadModeratorIds.includes(identity.providerUserId)) roles.push("lead_moderator");
  await creatorClient.flush();
  return roles;
}

async function discordRoles(identity: Identity, settings: Settings) {
  if (!settings.discordApplicationId || !settings.discordClientSecretEnc || !settings.discordGuildId) throw new Error("configure");
  const token = await usableToken("discord", identity.tokenEnc, settings.discordApplicationId, settings.discordClientSecretEnc,
    (old, next) => replacePlatformIdentityToken(identity.id, old, next));
  const currentUser = z.object({ id: z.string() }).parse(await remote("https://discord.com/api/v10/users/@me", { Authorization: `Bearer ${token.accessToken}` }));
  if (currentUser.id !== identity.providerUserId) throw new Error("reconnect");
  const member = memberSchema.parse(await remote(`https://discord.com/api/v10/users/@me/guilds/${settings.discordGuildId}/member`, { Authorization: `Bearer ${token.accessToken}` }));
  if (member.pending) return [];
  return member.roles;
}

async function syncEvidence(identities: Identity[], settings: Settings, mappings: Mapping[]): Promise<Evidence> {
  const result: Evidence = { grants: [], sync: { twitch: { state: "disabled", checkedAt: null }, discord: { state: "disabled", checkedAt: null } } };
  await Promise.all((["twitch", "discord"] as const).map(async (provider) => {
    const enabled = provider === "twitch" ? settings.permissionSyncTwitch : settings.permissionSyncDiscord;
    if (!enabled) return;
    const identity = identities.find((row) => row.provider === provider);
    if (!identity) { result.sync[provider] = { state: "unlinked", checkedAt: null }; return; }
    try {
      const roles = provider === "twitch" ? await twitchRoles(identity, settings, mappings) : await discordRoles(identity, settings);
      const checkedAt = new Date().toISOString();
      result.grants.push(...mappedGrants(provider, roles, mappings, new Date(Date.now() + 60000).toISOString()));
      result.sync[provider] = { state: "verified", checkedAt };
    } catch (error) {
      // Do not reuse old grants when upstream verification fails; another verified platform can still grant access.
      const known = ["reconnect", "configure", "rate_limited", "unavailable"];
      result.sync[provider] = { state: error instanceof Error && known.includes(error.message) ? error.message : "unavailable", checkedAt: null };
    }
  }));
  return result;
}

export async function resolveAccess(user: { id: string; email: string; emailVerified: boolean }) {
  const owner = user.emailVerified && isOwner(user);
  const identities = user.emailVerified ? await getPlatformIdentities(user.id) : [];
  const initialState = owner ? "owner" : "unverified";
  let evidence: Evidence = { grants: [], sync: { twitch: { state: initialState, checkedAt: null }, discord: { state: initialState, checkedAt: null } } };
  if (!owner && user.emailVerified) {
    const [settings, mappings] = await Promise.all([getSettings(), getPermissionMappings()]);
    // Cache evidence, not authorization forever: credential/mapping changes invalidate it immediately, roles after 60s.
    const key = JSON.stringify([identities, mappings, settings.twitchClientId, settings.twitchClientSecretEnc,
      settings.broadcasterUserId, settings.broadcasterTokenEnc, settings.discordApplicationId,
      settings.discordClientSecretEnc, settings.discordGuildId, settings.permissionSyncTwitch,
      settings.permissionSyncDiscord, settings.twitchLeadModeratorIds]);
    let entry = cache.get(user.id);
    if (!entry || entry.key !== key || entry.until <= Date.now()) {
      entry = { key, until: Date.now() + 60000, value: syncEvidence(identities, settings, mappings) };
      cache.set(user.id, entry);
      if (cache.size > 1000) for (const [id, row] of cache) if (row.until <= Date.now()) cache.delete(id);
    }
    evidence = await entry.value;
  }
  const subject: Subject = { owner, grants: evidence.grants };
  const identity = (provider: Platform) => {
    const row = identities.find((item) => item.provider === provider);
    return { linked: Boolean(row), login: row?.login ?? null, providerUserId: row?.providerUserId ?? null };
  };
  return { ...subject, identities: { twitch: identity("twitch"), discord: identity("discord") },
    capabilities: { twitch: capabilitiesFor(subject, "twitch"), discord: capabilitiesFor(subject, "discord") }, sync: evidence.sync };
}

export function requireCapability(subject: Subject, capability: Capability, platform?: Platform) {
  if (!canAccess(subject, capability, platform)) throw new TRPCError({ code: "FORBIDDEN", message: "Your linked platform roles do not permit this action." });
}
