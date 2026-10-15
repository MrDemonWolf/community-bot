import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

assert.equal(process.env.PROFILE_TEST, "true", "Use PROFILE_TEST=true only with the disposable development database.");
assert.equal(process.env.NODE_ENV, "development");
assert.ok(process.env.BETTER_AUTH_SECRET);
const { db } = await import("../packages/db/src/index");
const { eq } = await import("../packages/db/node_modules/drizzle-orm");
const { user: userTable, session: sessionTable } = await import("../packages/db/src/schema/auth");
const { getSettings, updateSettings } = await import("../packages/db/src/settings");
const { upsertPlatformIdentity, upsertPermissionMapping, deletePermissionMapping } = await import("../packages/db/src/features");
const { encrypt } = await import("../packages/db/src/crypto");
const { getPersonalProfile } = await import("../packages/db/src/profile");
const { appRouter } = await import("../packages/api/src/routers/index");
const { GET } = await import("../apps/web/src/app/api/profile-picture/route");
const sharp = (await import("../packages/api/node_modules/sharp")).default;
const originalSettings = await getSettings();
assert.ok(!originalSettings.discordEnabled && !originalSettings.twitchEnabled, "Stop both workers first.");
const realFetch = globalThis.fetch;
const ownerEmail = process.env.OWNER_EMAIL ?? "dev@localhost";
const [existingOwner] = await db.select().from(userTable).where(eq(userTable.email, ownerEmail));
const now = new Date();
const ownerUser = existingOwner ?? { id: randomUUID(), email: ownerEmail, emailVerified: true, name: "Profile fixture owner", image: null, createdAt: now, updatedAt: now };
if (!existingOwner) await db.insert(userTable).values(ownerUser);
const modUser = { ...ownerUser, id: randomUUID(), email: `profile-${randomUUID()}@example.invalid`, name: "Profile fixture moderator" };
const strangerUser = { ...modUser, id: randomUUID(), email: `profile-${randomUUID()}@example.invalid` };
await db.insert(userTable).values([modUser, strangerUser]);
const originalImages = (await db.$client.query("SELECT * FROM personal_avatar WHERE user_id=$1", [ownerUser.id])).rows;
const originalProfile = (await db.$client.query("SELECT * FROM personal_profile WHERE user_id=$1", [ownerUser.id])).rows;
const originalIdentities = (await db.$client.query("SELECT * FROM platform_identity WHERE user_id=$1", [ownerUser.id])).rows;
const sessions = [ownerUser, modUser, strangerUser].map((user) => ({ id: randomUUID(), userId: user.id, token: randomUUID(), expiresAt: new Date(Date.now() + 3600000), createdAt: now, updatedAt: now, ipAddress: null, userAgent: null }));
await db.insert(sessionTable).values(sessions);
const caller = (index: number, user: typeof ownerUser) => appRouter.createCaller({ db, session: { user, session: sessions[index]! } });
const owner = caller(0, ownerUser), moderator = caller(1, modUser), stranger = caller(2, strangerUser);
const anonymous = appRouter.createCaller({ db, session: null });
const png = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#00ACED" } }).png().toBuffer();
const modPng = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#ff3300" } }).png().toBuffer();
let providerFailure = false, wrongIdentity = false;
let checks = 0;
const mappingId = randomUUID();
const roleId = "975319753197531975";
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
const rejected = async (fn: () => Promise<unknown>, code: string) => { await assert.rejects(fn, (error: unknown) => (error as { code?: string }).code === code); checks++; };
const request = (index?: number, query = "") => {
  const token = index === undefined ? null : sessions[index]!.token;
  const signature = token ? createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(token).digest("base64") : "";
  return new Request(`http://localhost:3001/api/profile-picture${query}`, { headers: token ? { cookie: `better-auth.session_token=${encodeURIComponent(token + "." + signature)}` } : {} }) as Parameters<typeof GET>[0];
};
const identityToken = (clientId: string, accessToken: string) => encrypt(JSON.stringify({ clientId, accessToken, refreshToken: "fixture-refresh", expiresIn: 3600, obtainmentTimestamp: Date.now(), scope: ["identify", "guilds.members.read"] }));

globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input), authorization = new Headers(init?.headers).get("authorization");
  if (providerFailure) return new Response("unavailable", { status: 503 });
  if (url === "https://discord.com/api/v10/users/@me") return Response.json({ id: wrongIdentity ? "999999999999999999" : authorization === "Bearer fixture-mod-discord" ? "222222222222222222" : "111111111111111111", avatar: "a".repeat(32) });
  if (url === "https://discord.com/api/v10/users/@me/guilds/234567890123456789/member") return Response.json({ roles: [roleId] });
  if (url === "https://api.twitch.tv/helix/users") { assert.equal(authorization, "Bearer fixture-owner-twitch"); return Response.json({ data: [{ id: "333", profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/fixture.png" }] }); }
  if (url === "https://static-cdn.jtvnw.net/jtv_user_pictures/fixture.png" || /^https:\/\/cdn\.discordapp\.com\/avatars\/(111111111111111111|222222222222222222)\//.test(url)) return new Response(png, { headers: { "Content-Type": "image/png" } });
  throw new Error("Live network access is forbidden in personal profile fixtures");
}, { preconnect: realFetch.preconnect });

try {
  await db.$client.query("DELETE FROM personal_profile WHERE user_id=$1", [ownerUser.id]);
  await db.$client.query("DELETE FROM personal_avatar WHERE user_id=$1", [ownerUser.id]);
  await db.$client.query("DELETE FROM platform_identity WHERE user_id=$1", [ownerUser.id]);
  await updateSettings({ publicPageEnabled: false, permissionSyncDiscord: true, permissionSyncTwitch: false,
    discordApplicationId: "123456789012345678", discordClientSecretEnc: encrypt("fixture-discord-secret"), discordGuildId: "234567890123456789",
    twitchClientId: "fixtureprofile123", twitchClientSecretEnc: encrypt("fixture-twitch-secret") });
  await upsertPermissionMapping({ id: mappingId, provider: "discord", sourceRoleId: roleId, role: "moderator", scopes: ["discord"] });
  await upsertPlatformIdentity({ userId: ownerUser.id, provider: "discord", providerUserId: "111111111111111111", login: "fixture-owner", tokenEnc: identityToken("123456789012345678", "fixture-owner-discord") });
  await upsertPlatformIdentity({ userId: ownerUser.id, provider: "twitch", providerUserId: "333", login: "fixture-owner-twitch", tokenEnc: identityToken("fixtureprofile123", "fixture-owner-twitch") });
  await upsertPlatformIdentity({ userId: modUser.id, provider: "discord", providerUserId: "222222222222222222", login: "fixture-mod", tokenEnc: identityToken("123456789012345678", "fixture-mod-discord") });
  check((await owner.profile.get()).url === null, "New personal profiles use initials, with no shared image");
  await rejected(() => anonymous.profile.upload({ pngBase64: png.toString("base64") }), "UNAUTHORIZED");
  await rejected(() => stranger.profile.select({ source: "default" }), "FORBIDDEN");
  await rejected(() => owner.profile.select({ source: "custom" }), "BAD_REQUEST");
  await rejected(() => owner.profile.upload({ pngBase64: Buffer.from("<svg/>").toString("base64") }), "BAD_REQUEST");
  await rejected(() => owner.profile.upload({ pngBase64: "A".repeat(700000) }), "BAD_REQUEST");
  const custom = await owner.profile.upload({ pngBase64: png.toString("base64") });
  check(custom.source === "custom" && custom.name === ownerUser.name && !JSON.stringify(custom).includes("webp"), "Owner upload returns a safe personal DTO");
  check((await moderator.profile.get()).url === null, "Moderator cannot see the owner's selected picture");
  const modCustom = await moderator.profile.upload({ pngBase64: modPng.toString("base64") });
  check(modCustom.source === "custom" && modCustom.version !== custom.version, "Moderator can edit their own avatar");
  check((await owner.profile.get()).version === custom.version, "Moderator writes cannot alter the owner profile");
  const served = await GET(request(1, `?userId=${ownerUser.id}&v=${custom.version}`));
  check(served.status === 200 && served.headers.get("content-type") === "image/webp" && served.headers.get("cache-control")?.includes("no-store"), "Authenticated image route serves a private WebP");
  const modImage = (await getPersonalProfile(modUser.id)).images[0]!;
  check(Buffer.from(await served.arrayBuffer()).equals(modImage.webp), "Image route ignores attempted cross-user IDs and serves only the session user's picture");
  check((await GET(request())).status === 404 && (await GET(request(2))).status === 404, "Anonymous and nonstaff sessions cannot fetch pictures");
  await updateSettings({ publicPageEnabled: true });
  check((await GET(request())).status === 404, "Public channel opt-in never makes personal avatars public");
  const twitch = await owner.profile.select({ source: "twitch" });
  check(twitch.source === "twitch" && twitch.choices.find((choice) => choice.source === "custom")?.hasImage, "Own Twitch photo preserves saved custom crop");
  const discord = await owner.profile.select({ source: "discord" });
  check(discord.source === "discord" && !JSON.stringify(discord).includes("111111111111111111"), "Own Discord photo does not expose provider IDs");
  wrongIdentity = true;
  await rejected(() => owner.profile.select({ source: "discord" }), "BAD_GATEWAY");
  wrongIdentity = false; providerFailure = true;
  await rejected(() => owner.profile.select({ source: "twitch" }), "BAD_GATEWAY");
  check((await owner.profile.get()).source === "discord", "Provider failure preserves the current selection");
  providerFailure = false;
  check((await owner.profile.select({ source: "custom" })).version === custom.version, "Switching back keeps original personal image version");
  check((await owner.profile.select({ source: "default" })).url === null, "Initials selection has no image URL");
  check((await GET(request(0))).status === 404, "Initials selection hides retained image snapshots");
  await assert.rejects(() => db.$client.query("UPDATE personal_profile SET source='foreign' WHERE user_id=$1", [ownerUser.id])); checks++;
  await assert.rejects(() => db.$client.query("UPDATE personal_avatar SET webp=$1 WHERE user_id=$2", [Buffer.from("<svg/>"), ownerUser.id])); checks++;
  const oversized = Buffer.alloc(262145); oversized.write("RIFF"); oversized.write("WEBP", 8);
  await assert.rejects(() => db.$client.query("UPDATE personal_avatar SET webp=$1 WHERE user_id=$2", [oversized, ownerUser.id])); checks++;
  const usage = await db.$client.query("SELECT count(*)::int AS slots, sum(octet_length(webp))::int AS bytes FROM personal_avatar WHERE user_id=$1", [ownerUser.id]);
  check(usage.rows[0].slots === 3 && usage.rows[0].bytes < 1000000, "Three compressed slots stay under the personal storage budget");
  const missingUser = randomUUID();
  await assert.rejects(() => db.$client.query("INSERT INTO personal_profile(user_id) VALUES($1)", [missingUser])); checks++;
  await db.delete(userTable).where(eq(userTable.id, modUser.id));
  check((await getPersonalProfile(modUser.id)).images.length === 0, "Deleting an account cascades its private image data");
} finally {
  globalThis.fetch = realFetch;
  try {
    await db.$client.query("DELETE FROM personal_profile WHERE user_id=$1", [ownerUser.id]);
    await db.$client.query("DELETE FROM personal_avatar WHERE user_id=$1", [ownerUser.id]);
    await db.$client.query("DELETE FROM platform_identity WHERE user_id=$1", [ownerUser.id]);
    for (const row of originalImages) await db.$client.query("INSERT INTO personal_avatar(user_id,source,webp,version,updated_at) VALUES($1,$2,$3,$4,$5)", [row.user_id, row.source, row.webp, row.version, row.updated_at]);
    for (const row of originalProfile) await db.$client.query("INSERT INTO personal_profile(user_id,source) VALUES($1,$2)", [row.user_id, row.source]);
    for (const row of originalIdentities) await db.$client.query("INSERT INTO platform_identity(id,user_id,provider,provider_user_id,login,token_enc,roles,verified_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [row.id, row.user_id, row.provider, row.provider_user_id, row.login, row.token_enc, JSON.stringify(row.roles), row.verified_at, row.expires_at]);
    await db.$client.query("DELETE FROM session WHERE id=ANY($1::text[])", [sessions.map((session) => session.id)]);
    await db.$client.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [[modUser.id, strangerUser.id, ...(existingOwner ? [] : [ownerUser.id])]]);
    await deletePermissionMapping(mappingId);
    const { id: _id, createdAt: _created, updatedAt: _updated, ...restore } = originalSettings;
    await updateSettings(restore);
  } finally { await db.$client.end(); }
}
console.log(`Personal profile integration checks passed: ${checks}. Providers mocked; original settings and profiles restored.`);
