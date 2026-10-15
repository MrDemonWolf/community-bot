import { randomBytes } from "node:crypto";
import { auth } from "@community-bot/auth";
import { getSettings } from "@community-bot/db/settings";
import { beginPlatformIdentityLink } from "@community-bot/db/features";
import { env } from "@community-bot/env/server";
import { NextRequest, NextResponse } from "next/server";
import { identityApp, identityProvider } from "@/lib/identity-oauth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const provider = identityProvider((await ctx.params).provider);
  if (!provider) return new NextResponse("Unknown identity provider", { status: 400 });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user.emailVerified) return new NextResponse("Sign in with Google first.", { status: 401 });
  const app = identityApp(provider, await getSettings());
  if (!app) return new NextResponse("The creator must configure this platform's OAuth application first.", { status: 503 });
  const state = randomBytes(32).toString("hex");
  await beginPlatformIdentityLink(session.user.id, provider, state);
  const target = new URL(provider === "twitch" ? "https://id.twitch.tv/oauth2/authorize" : "https://discord.com/oauth2/authorize");
  target.search = new URLSearchParams({ client_id: app.clientId,
    redirect_uri: `${env.BETTER_AUTH_URL}/api/identity/callback/${provider}`,
    response_type: "code", scope: provider === "discord" ? "identify guilds.members.read" : "", state,
    ...(provider === "twitch" ? { force_verify: "true" } : { prompt: "consent" }),
  }).toString();
  const response = NextResponse.redirect(target);
  response.cookies.set(`identity_oauth_${provider}`, JSON.stringify({ state, userId: session.user.id,
    sessionId: session.session.id, clientId: app.clientId, version: app.version }), {
    httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production", maxAge: 600, path: "/",
  });
  return response;
}
