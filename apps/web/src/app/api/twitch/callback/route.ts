import { auth, isOwner } from "@community-bot/auth";
import { decrypt } from "@community-bot/db/crypto";
import { getSettings, saveTwitchConnection, verifyOwnerTwitchConnection } from "@community-bot/db/settings";
import { encodeToken } from "@community-bot/db/twitch";
import { env } from "@community-bot/env/server";
import { TWITCH_BOT_SCOPES, twitchCreatorScopes } from "@community-bot/core/features";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { validOAuthState } from "@/lib/oauth-state";

const STATE_COOKIE = "twitch_oauth_state";
const cookieSchema = z.object({
  state: z.string(),
  clientId: z.string(),
  sessionId: z.string(),
});
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.array(z.string()).default([]),
});
const userSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      login: z.string().regex(/^[a-z0-9_]+$/),
    }),
  ),
});
export async function GET(req: NextRequest) {
  const fail = (message: string, status: number) => {
    const res = new NextResponse(message, { status });
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || !isOwner(session.user)) return fail("Unauthorized", 401);
  let cookie: z.infer<typeof cookieSchema>;
  try {
    cookie = cookieSchema.parse(
      JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? ""),
    );
  } catch {
    return fail("OAuth session expired. Start the connection again.", 400);
  }
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (
    !state ||
    !code ||
    !validOAuthState(state, cookie.state) ||
    cookie.sessionId !== session.session.id
  )
    return fail("Invalid OAuth state", 400);
  const role = state.split(":")[0];
  if (role !== "broadcaster" && role !== "bot")
    return fail("Invalid account role", 400);
  const s = await getSettings();
  if (
    cookie.clientId !== s.twitchClientId ||
    !s.twitchClientId ||
    !s.twitchClientSecretEnc
  )
    return fail("Twitch app changed. Start the connection again.", 400);
  const attempt = { userId: session.user.id, sessionId: session.session.id, role, state } as const;
  if (!await verifyOwnerTwitchConnection(attempt, s.twitchClientId, s.twitchClientSecretEnc)) {
    return fail("This Twitch connection attempt expired or was canceled. Start again.", 409);
  }
  try {
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: s.twitchClientId,
        client_secret: decrypt(s.twitchClientSecretEnc),
        code,
        grant_type: "authorization_code",
        redirect_uri: env.BETTER_AUTH_URL + "/api/twitch/callback",
      }),
    });
    if (!tokenRes.ok)
      return fail("Twitch authorization failed. Reconnect the account.", 502);
    const token = tokenSchema.parse(await tokenRes.json());
    if (
      !(role === "bot" ? TWITCH_BOT_SCOPES : twitchCreatorScopes(s)).every((scope) =>
        token.scope.includes(scope),
      )
    )
      return fail("Required Twitch permissions were not granted. Reconnect and approve the selected features.", 400);
    const userRes = await fetch("https://api.twitch.tv/helix/users", {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: "Bearer " + token.access_token,
        "Client-Id": s.twitchClientId,
      },
    });
    if (!userRes.ok)
      return fail("Could not read the Twitch account. Try again.", 502);
    const user = userSchema.parse(await userRes.json()).data[0];
    if (!user) return fail("Twitch returned no account.", 502);
    const latest = await getSettings();
    if (
      latest.twitchClientId !== s.twitchClientId ||
      latest.twitchClientSecretEnc !== s.twitchClientSecretEnc
    )
      return fail("Twitch app changed. Reconnect.", 409);
    const bundle = encodeToken({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      obtainmentTimestamp: Date.now(),
      scope: token.scope,
    });
    const saved = await saveTwitchConnection(
      s.twitchClientId,
      s.twitchClientSecretEnc,
      role === "broadcaster"
        ? {
            broadcasterUserId: user.id,
            broadcasterLogin: user.login,
            broadcasterTokenEnc: bundle,
            channelName: user.login,
            twitchEnabled: false,
          }
        : {
            botUserId: user.id,
            botLogin: user.login,
            botTokenEnc: bundle,
            twitchEnabled: false,
          },
      attempt,
    );
    if (!saved) return fail("This Twitch connection was canceled, superseded, or changed. Start again.", 409);
    const res = NextResponse.redirect(
      env.BETTER_AUTH_URL + "/setup?connected=" + role,
    );
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    return fail(
      "Twitch connection failed. Check the app settings and try again.",
      502,
    );
  }
}
