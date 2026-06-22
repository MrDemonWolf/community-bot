import { auth } from "@community-bot/auth";
import { updateSettings } from "@community-bot/db/settings";
import { encodeToken } from "@community-bot/db/twitch";
import { env } from "@community-bot/env/server";
import { NextResponse, type NextRequest } from "next/server";

import { STATE_COOKIE } from "../connect/[role]/route";

type Role = "broadcaster" | "bot";

export async function GET(req: NextRequest) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return new NextResponse("Twitch app not configured", { status: 503 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return new NextResponse("invalid oauth state", { status: 400 });
  }
  const role = state.split(":")[0] as Role;
  const redirectUri = `${env.BETTER_AUTH_URL}/api/twitch/callback`;

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return new NextResponse(`token exchange failed: ${await tokenRes.text()}`, { status: 502 });
  }
  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
  };

  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: { Authorization: `Bearer ${token.access_token}`, "Client-Id": env.TWITCH_CLIENT_ID },
  });
  if (!userRes.ok) {
    return new NextResponse(`user fetch failed: ${await userRes.text()}`, { status: 502 });
  }
  const tUser = ((await userRes.json()) as { data: { id: string; login: string }[] }).data[0];
  if (!tUser) return new NextResponse("no twitch user returned", { status: 502 });

  const bundle = encodeToken({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    obtainmentTimestamp: Date.now(),
    scope: token.scope,
  });

  await updateSettings(
    role === "broadcaster"
      ? {
          broadcasterUserId: tUser.id,
          broadcasterLogin: tUser.login,
          broadcasterTokenEnc: bundle,
        }
      : { botUserId: tUser.id, botLogin: tUser.login, botTokenEnc: bundle },
  );

  const res = NextResponse.redirect(`${env.BETTER_AUTH_URL}/setup?connected=${role}`);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
