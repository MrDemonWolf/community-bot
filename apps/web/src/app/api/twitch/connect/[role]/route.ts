import { randomBytes } from "node:crypto";

import { auth } from "@community-bot/auth";
import { env } from "@community-bot/env/server";
import { NextResponse, type NextRequest } from "next/server";

// Custom Twitch OAuth (separate from dashboard login): connects the broadcaster
// (read scopes) and the wolfaide bot (chat:read/chat:edit). Two logins, one app.
// Redirect URI must match the Twitch app exactly: <BETTER_AUTH_URL>/api/twitch/callback
type Role = "broadcaster" | "bot";

const SCOPES: Record<Role, string> = {
  broadcaster: "user:read:email channel:read:subscriptions moderator:read:followers",
  bot: "chat:read chat:edit",
};

export const STATE_COOKIE = "twitch_oauth_state";

export async function GET(req: NextRequest, ctx: { params: Promise<{ role: string }> }) {
  const { role } = await ctx.params;
  if (role !== "broadcaster" && role !== "bot") {
    return new NextResponse("bad role", { status: 400 });
  }
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return new NextResponse("Twitch app not configured (set TWITCH_CLIENT_ID/SECRET)", {
      status: 503,
    });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const state = `${role}:${randomBytes(16).toString("hex")}`;
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.BETTER_AUTH_URL}/api/twitch/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES[role]);
  url.searchParams.set("state", state);
  url.searchParams.set("force_verify", "true"); // let the user pick the right account

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
