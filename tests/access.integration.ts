import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "bun:test";

assert.equal(process.env.ACCESS_TEST, "true", "Set ACCESS_TEST=true only against the disposable development database.");
assert.equal(process.env.NODE_ENV, "development");
const { db } = await import("../packages/db/src/index");
const { user } = await import("../packages/db/src/schema/auth");
const { permissionMapping } = await import("../packages/db/src/schema/features");
const { getSettings, updateSettings, beginOwnerTwitchConnection, verifyOwnerTwitchConnection, saveTwitchConnection } = await import("../packages/db/src/settings");
const { getPermissionMappings, upsertPermissionMapping, upsertPlatformIdentity, deletePlatformIdentity, beginPlatformIdentityLink, savePlatformIdentity } = await import("../packages/db/src/features");
const { encrypt } = await import("../packages/db/src/crypto");
const { encodeToken, decodeToken } = await import("../packages/db/src/twitch");
mock.module("@community-bot/twitch", () => ({ getCreatorClient: async (settings: { broadcasterUserId: string; broadcasterTokenEnc: string }) => ({
  userId: settings.broadcasterUserId, auth: { getAccessTokenForUser: async () => decodeToken(settings.broadcasterTokenEnc) },
  api: {}, flush: async () => {},
}) }));
const { resolveAccess } = await import("../packages/api/src/access");
const { canAccess } = await import("../packages/core/src/permissions");
const { appRouter } = await import("../packages/api/src/routers/index");
const original = await getSettings();
const originalMappings = await getPermissionMappings();
if (original.twitchEnabled || original.discordEnabled) { await db.$client.end(); throw new Error("Stop both workers first."); }
const first = { id: randomUUID(), name: "Access fixture", email: randomUUID() + "@example.invalid", emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() };
const second = { ...first, id: randomUUID(), email: randomUUID() + "@example.invalid" };
const realFetch = globalThis.fetch;
const realNow = Date.now;
let clock = realNow();
let discordRoles: string[] = [];
let twitchDown = false;
let upstreamCalls = 0;
const token = (accessToken: string, scope: string[] = [], clientId = "fixtureapp12345") => {
  const bundle = { clientId, accessToken, refreshToken: "fixture-refresh", expiresIn: 3600, obtainmentTimestamp: clock, scope };
  return encodeToken(bundle);
};
function check(value: unknown, message: string) { assert.ok(value, message); checks++; }
let checks = 0;

try {
  Date.now = () => clock;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    assert.ok(["api.twitch.tv", "discord.com"].includes(url.hostname), "Unexpected external request blocked");
    upstreamCalls++;
    if (url.hostname === "api.twitch.tv") {
      if (twitchDown) return new Response("", { status: 401 });
      const headers = new Headers(init?.headers);
      if (url.pathname === "/helix/users") return Response.json({ data: [{ id: headers.get("Authorization")?.includes("identity-two") ? "202" : "101" }] });
      const id = url.searchParams.get("user_id");
      const qualifies = (url.pathname === "/helix/moderation/moderators" && id === "101")
        || (url.pathname === "/helix/subscriptions" && id === "202");
      return Response.json({ data: qualifies ? [{ user_id: id }] : [] });
    }
    if (url.pathname === "/api/v10/users/@me") return Response.json({ id: "404" });
    assert.ok(url.pathname.endsWith("/member"), "Unexpected Discord request blocked");
    return Response.json({ roles: discordRoles, pending: false });
  }) as typeof fetch;
  await db.insert(user).values([first, second]);
  await db.delete(permissionMapping);
  await updateSettings({ twitchEnabled: false, discordEnabled: false, permissionSyncTwitch: true, permissionSyncDiscord: true,
    twitchClientId: "fixtureapp12345", twitchClientSecretEnc: encrypt("fixture-secret"), broadcasterUserId: "999", broadcasterLogin: "fixturecreator", channelName: "fixturecreator",
    broadcasterTokenEnc: token("fixture-creator", ["moderation:read", "channel:read:vips", "channel:read:subscriptions"]),
    discordApplicationId: "123456789012345678", discordClientSecretEnc: encrypt("fixture-discord-secret"),
    discordGuildId: "234567890123456789", twitchLeadModeratorIds: [] });
  const modMapping = await upsertPermissionMapping({ id: randomUUID(), provider: "twitch", sourceRoleId: "moderator", role: "moderator", scopes: ["twitch"] });
  await upsertPermissionMapping({ id: randomUUID(), provider: "twitch", sourceRoleId: "lead_moderator", role: "lead_moderator", scopes: ["twitch"] });
  await upsertPermissionMapping({ id: randomUUID(), provider: "twitch", sourceRoleId: "subscriber", role: "subscriber", scopes: ["twitch"] });
  await upsertPermissionMapping({ id: randomUUID(), provider: "discord", sourceRoleId: "345678901234567890", role: "admin", scopes: ["discord"] });
  await upsertPlatformIdentity({ userId: first.id, provider: "twitch", providerUserId: "101", login: "fixture-mod", tokenEnc: token("identity-one") });
  await upsertPlatformIdentity({ userId: first.id, provider: "discord", providerUserId: "404", login: "fixture-discord", tokenEnc: token("identity-discord", ["identify", "guilds.members.read"], "123456789012345678") });
  await upsertPlatformIdentity({ userId: second.id, provider: "twitch", providerUserId: "202", login: "fixture-sub", tokenEnc: token("identity-two") });
  const mod = await resolveAccess(first);
  check(canAccess(mod, "dashboard:view") && canAccess(mod, "bot:mute", "twitch"), "Native moderator mapping grants Twitch dashboard and mute");
  check(!canAccess(mod, "bot:connect", "twitch") && !canAccess(mod, "presence:manage", "discord"), "Moderator cannot join or cross platform");
  const calls = upstreamCalls;
  await resolveAccess(first);
  check(calls === upstreamCalls, "Fresh permission evidence is cached");
  const session = { id: randomUUID(), token: "fixture-session", userId: first.id, expiresAt: new Date(clock + 3600000), createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null };
  const caller = appRouter.createCaller({ db, session: { session, user: first } });
  await assert.rejects(() => caller.settings.control({ service: "twitch", action: "join" }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  await assert.rejects(() => caller.settings.configureTwitch({ clientId: "fixtureapp12345", clientSecret: "fixture-secret" }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  await assert.rejects(() => caller.settings.updateDiscordPresence({ status: "online", activityType: "watching", activityText: "fixture" }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  await assert.rejects(() => caller.features.update({ featureId: "uptime", platform: "twitch", enabled: false, config: { cooldownSeconds: 3 } }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  const view = await caller.settings.get();
  check(view.twitchClientId === null && view.discordApplicationId === null && view.discordGuildId === null, "Staff settings projection hides app and guild identifiers");
  discordRoles = ["345678901234567890"];
  clock += 61000;
  const combined = await resolveAccess(first);
  check(canAccess(combined, "presence:manage", "discord") && !canAccess(combined, "features:manage", "twitch"), "Mapped Discord Admin remains scoped while Twitch Moderator persists");
  check(!canAccess(combined, "integrations:manage", "discord") && !canAccess(combined, "workspace:manage", "twitch"), "Staff Admin cannot access owner settings");
  await assert.rejects(() => caller.features.update({ featureId: "uptime", platform: "twitch", enabled: false, config: { cooldownSeconds: 3 } }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  const ownerCaller = appRouter.createCaller({ db, session: { session, user: { ...first, email: process.env.OWNER_EMAIL ?? "dev@localhost" } } });
  await assert.rejects(() => ownerCaller.features.update({ featureId: "presence", platform: "twitch", enabled: true, config: {} }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  await assert.rejects(() => ownerCaller.features.update({ featureId: "channel-points", platform: "discord", enabled: false, config: {} }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  await assert.rejects(() => ownerCaller.features.update({ featureId: "uptime", platform: "twitch", enabled: true, config: { cooldownSeconds: 0 } }), (error: unknown) => (error as { code?: string }).code === "BAD_REQUEST"); checks++;
  await updateSettings({ twitchLeadModeratorIds: ["101"] });
  check(canAccess(await resolveAccess(first), "bot:connect", "twitch"), "Owner lead list elevates only a currently verified moderator");
  const subscriber = await resolveAccess(second);
  check(canAccess(subscriber, "command:subscriber", "twitch") && !canAccess(subscriber, "dashboard:view"), "Subscriber grants perks without dashboard powers");
  const subCaller = appRouter.createCaller({ db, session: { session: { ...session, userId: second.id }, user: second } });
  await assert.rejects(() => subCaller.settings.get(), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  check((await subCaller.access.me()).identities.twitch.linked, "Subscriber may inspect its own linked access");
  twitchDown = true; clock += 61000;
  const revoked = await resolveAccess(first);
  check(!canAccess(revoked, "bot:mute", "twitch") && canAccess(revoked, "presence:manage", "discord"), "Revoked Twitch identity fails closed while verified Discord grant survives");
  await deletePlatformIdentity(first.id, "discord");
  check(!canAccess(await resolveAccess(first), "presence:manage", "discord"), "Unlink invalidates cached access immediately");
  twitchDown = false;
  await updateSettings({ permissionSyncTwitch: false });
  check(!canAccess(await resolveAccess(first), "dashboard:view"), "Disabling sync removes grants from existing sessions");
  await updateSettings({ permissionSyncTwitch: true, twitchLeadModeratorIds: [] });
  await db.$client.query('DELETE FROM permission_mapping WHERE id = $1', [modMapping.id]);
  check(!canAccess(await resolveAccess(first), "bot:mute", "twitch"), "Deleting a mapping invalidates its grants immediately");
  const app = await getSettings();
  const expected = { provider: "twitch" as const, clientId: app.twitchClientId!, clientSecretEnc: app.twitchClientSecretEnc! };
  const linked = { userId: first.id, provider: "twitch" as const, providerUserId: "101", login: "fixture-mod", tokenEnc: token("identity-one") };
  await beginPlatformIdentityLink(first.id, "twitch", "nonce-a");
  await deletePlatformIdentity(first.id, "twitch");
  check(!await savePlatformIdentity({ ...expected, linkState: "nonce-a" }, linked), "Unlink invalidates pending OAuth callback");
  await beginPlatformIdentityLink(first.id, "twitch", "nonce-b");
  check(Boolean(await savePlatformIdentity({ ...expected, linkState: "nonce-b" }, linked)), "Current OAuth nonce saves verified identity");
  check(!await savePlatformIdentity({ ...expected, linkState: "nonce-b" }, linked), "Successful OAuth nonce cannot replay");
  await beginPlatformIdentityLink(first.id, "twitch", "nonce-c");
  await beginPlatformIdentityLink(first.id, "twitch", "nonce-d");
  check(!await savePlatformIdentity({ ...expected, linkState: "nonce-c" }, linked), "New OAuth attempt invalidates previous nonce");
  for (const role of ["bot", "broadcaster"] as const) {
    const attempt = { userId: first.id, sessionId: session.id, role, state: role + ":owner-nonce-a" };
    const patch = role === "bot" ? { botUserId: "555", botLogin: "fixturebot", botTokenEnc: token("fixture-bot"), twitchEnabled: false }
      : { broadcasterUserId: "999", broadcasterLogin: "fixturecreator", broadcasterTokenEnc: token("fixture-creator"), channelName: "fixturecreator", twitchEnabled: false };
    await beginOwnerTwitchConnection(attempt, app.twitchClientId!, app.twitchClientSecretEnc!);
    await ownerCaller.settings.disconnectTwitch({ role });
    check(!await verifyOwnerTwitchConnection(attempt, app.twitchClientId!, app.twitchClientSecretEnc!), "Owner disconnect invalidates pending " + role + " exchange");
    check(!await saveTwitchConnection(app.twitchClientId!, app.twitchClientSecretEnc!, patch, attempt), "Delayed owner " + role + " callback cannot restore credentials");
    const current = { ...attempt, state: role + ":owner-nonce-b" };
    await beginOwnerTwitchConnection(current, app.twitchClientId!, app.twitchClientSecretEnc!);
    check(!await saveTwitchConnection(app.twitchClientId!, app.twitchClientSecretEnc!, patch, { ...current, sessionId: "another-session" }), "Owner OAuth state is session-bound");
    check(await saveTwitchConnection(app.twitchClientId!, app.twitchClientSecretEnc!, patch, current), "Current owner " + role + " nonce saves once");
    check(!await saveTwitchConnection(app.twitchClientId!, app.twitchClientSecretEnc!, patch, current), "Owner " + role + " callback cannot replay");
    const old = { ...attempt, state: role + ":owner-nonce-c" };
    const next = { ...attempt, state: role + ":owner-nonce-d" };
    await beginOwnerTwitchConnection(old, app.twitchClientId!, app.twitchClientSecretEnc!);
    await beginOwnerTwitchConnection(next, app.twitchClientId!, app.twitchClientSecretEnc!);
    check(!await saveTwitchConnection(app.twitchClientId!, app.twitchClientSecretEnc!, patch, old), "New owner OAuth attempt supersedes old callback");
    const rotated = encrypt("rotated-fixture-secret");
    await updateSettings({ twitchClientSecretEnc: rotated });
    check(!await verifyOwnerTwitchConnection(next, app.twitchClientId!, rotated), "Owner OAuth nonce binds the app secret at connection start");
    check(!await saveTwitchConnection(app.twitchClientId!, rotated, patch, next), "Same-client secret rotation rejects a pending owner callback");
    await ownerCaller.settings.disconnectTwitch({ role });
    await updateSettings({ twitchClientSecretEnc: app.twitchClientSecretEnc });
    const racing = { ...attempt, state: role + ":owner-race" };
    await beginOwnerTwitchConnection(racing, app.twitchClientId!, app.twitchClientSecretEnc!);
    await Promise.all([saveTwitchConnection(app.twitchClientId!, app.twitchClientSecretEnc!, patch, racing), ownerCaller.settings.disconnectTwitch({ role })]);
    const disconnected = await getSettings();
    check(role === "bot" ? disconnected.botTokenEnc === null : disconnected.broadcasterTokenEnc === null,
      "Concurrent owner callback and disconnect finish disconnected");
  }
  await assert.rejects(() => beginOwnerTwitchConnection({ userId: first.id, sessionId: session.id, role: "bot", state: "" }, app.twitchClientId!, app.twitchClientSecretEnc!)); checks++;
} finally {
  globalThis.fetch = realFetch; Date.now = realNow;
  try {
    for (const id of [first.id, second.id]) for (const provider of ["twitch", "discord"] as const) await deletePlatformIdentity(id, provider);
    await db.$client.query("DELETE FROM verification WHERE identifier = ANY($1::text[])", [[`owner-twitch:${first.id}:bot`, `owner-twitch:${first.id}:broadcaster`]]);
    await db.$client.query('DELETE FROM "user" WHERE id IN ($1, $2)', [first.id, second.id]);
    await db.delete(permissionMapping);
    for (const mapping of originalMappings) await upsertPermissionMapping(mapping);
    const { id: _id, createdAt: _created, updatedAt: _updated, ...restore } = original;
    await updateSettings(restore);
  } finally { await db.$client.end(); }
}
console.log(`Access integration checks passed: ${checks}. Provider calls were mocked; original settings and mappings restored.`);
