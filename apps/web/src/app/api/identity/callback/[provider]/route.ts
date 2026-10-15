import { auth } from "@community-bot/auth";
import { decrypt } from "@community-bot/db/crypto";
import { savePlatformIdentity } from "@community-bot/db/features";
import { getSettings } from "@community-bot/db/settings";
import { encodeToken } from "@community-bot/db/twitch";
import { env } from "@community-bot/env/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identityApp, identityProvider } from "@/lib/identity-oauth";
import { validOAuthState } from "@/lib/oauth-state";

const stateSchema = z.object({ state: z.string(), userId: z.string(), sessionId: z.string(), clientId: z.string(), version: z.string() });
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1),
  expires_in: z.number().positive(), scope: z.union([z.string(), z.array(z.string())]).optional() });
const profileSchema = z.object({ id: z.string().regex(/^\d+$/), login: z.string().optional(), username: z.string().optional() });

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const provider = identityProvider((await ctx.params).provider);
  if (!provider) return new NextResponse("Unknown identity provider", { status: 400 });
  const cookieName = `identity_oauth_${provider}`;
  const fail = (message: string, status: number) => {
    const response = new NextResponse(message, { status }); response.cookies.delete(cookieName); return response;
  };
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user.emailVerified) return fail("Sign in with Google first.", 401);
  let savedState: z.infer<typeof stateSchema>;
  try { savedState = stateSchema.parse(JSON.parse(req.cookies.get(cookieName)?.value ?? "")); }
  catch { return fail("Link expired. Start again from My access.", 400); }
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !validOAuthState(req.nextUrl.searchParams.get("state"), savedState.state)
    || savedState.userId !== session.user.id || savedState.sessionId !== session.session.id) return fail("Invalid identity linking session", 400);
  const app = identityApp(provider, await getSettings());
  if (!app || savedState.clientId !== app.clientId || savedState.version !== app.version) return fail("Platform configuration changed. Link again.", 409);
  try {
    const tokenResponse = await fetch(provider === "twitch" ? "https://id.twitch.tv/oauth2/token" : "https://discord.com/api/v10/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: app.clientId,
        client_secret: decrypt(app.secretEnc), redirect_uri: `${env.BETTER_AUTH_URL}/api/identity/callback/${provider}` }),
    });
    if (!tokenResponse.ok) return fail("Identity authorization failed. Please link again.", 502);
    const token = tokenSchema.parse(await tokenResponse.json());
    const scope = typeof token.scope === "string" ? token.scope.split(" ") : token.scope ?? [];
    if (provider === "discord" && !["identify", "guilds.members.read"].every((value) => scope.includes(value))) return fail("Discord member permissions were not granted.", 400);
    const profileResponse = await fetch(provider === "twitch" ? "https://api.twitch.tv/helix/users" : "https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}`, ...(provider === "twitch" ? { "Client-Id": app.clientId } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!profileResponse.ok) return fail("Could not verify the linked account.", 502);
    const raw = await profileResponse.json();
    const profile = profileSchema.parse(provider === "twitch" ? z.object({ data: z.array(z.unknown()) }).parse(raw).data[0] : raw);
    const bundle = { clientId: app.clientId, accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresIn: token.expires_in, obtainmentTimestamp: Date.now(), scope };
    const saved = await savePlatformIdentity({ provider, clientId: app.clientId, clientSecretEnc: app.secretEnc, guildId: app.guildId, linkState: savedState.state }, {
      userId: session.user.id, provider, providerUserId: profile.id, login: profile.login ?? profile.username ?? profile.id,
      tokenEnc: encodeToken(bundle),
    });
    if (!saved) return fail("Platform configuration changed. Link again.", 409);
    const response = NextResponse.redirect(`${env.BETTER_AUTH_URL}/access?linked=${provider}`);
    response.cookies.delete(cookieName); return response;
  } catch { return fail("Could not link this identity. It may already belong to another dashboard account.", 409); }
}
