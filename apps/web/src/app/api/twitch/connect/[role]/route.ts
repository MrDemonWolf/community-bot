import { randomBytes } from "node:crypto";
import { auth, isOwner } from "@community-bot/auth";
import { beginOwnerTwitchConnection, getSettings } from "@community-bot/db/settings";
import { env } from "@community-bot/env/server";
import { TWITCH_BOT_SCOPES, twitchCreatorScopes } from "@community-bot/core/features";
import { NextResponse, type NextRequest } from "next/server";

const STATE_COOKIE = "twitch_oauth_state";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ role: string }> },
) {
  const { role } = await ctx.params;
  if (role !== "broadcaster" && role !== "bot")
    return new NextResponse("Invalid account role", { status: 400 });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || !isOwner(session.user))
    return new NextResponse("Unauthorized", { status: 401 });
  const s = await getSettings();
  if (!s.twitchClientId || !s.twitchClientSecretEnc)
    return new NextResponse(
      "Save the Twitch application in the dashboard first.",
      { status: 503 },
    );
  const state = role + ":" + randomBytes(32).toString("hex");
  await beginOwnerTwitchConnection({ userId: session.user.id, sessionId: session.session.id, role, state }, s.twitchClientId, s.twitchClientSecretEnc);
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: s.twitchClientId,
    redirect_uri: env.BETTER_AUTH_URL + "/api/twitch/callback",
    response_type: "code",
    scope: (role === "broadcaster" ? twitchCreatorScopes(s) : TWITCH_BOT_SCOPES).join(" "),
    state,
    force_verify: "true",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(
    STATE_COOKIE,
    JSON.stringify({
      state,
      clientId: s.twitchClientId,
      sessionId: session.session.id,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    },
  );
  return res;
}
