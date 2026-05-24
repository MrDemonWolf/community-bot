import { auth } from "@community-bot/auth";
import { db } from "@community-bot/db";
import { oauthTokens } from "@community-bot/db/schema/oauthTokens";
import { userMeta } from "@community-bot/db/schema/userMeta";
import { auditLogs } from "@community-bot/db/schema/auditLogs";
import { env } from "@community-bot/env/server";
import { encrypt } from "@community-bot/shared/crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const STATE_COOKIE = "tw_bot_oauth_state";
const STATE_TTL_SECONDS = 600;

const SCOPES = ["chat:read", "chat:edit", "channel:moderate", "moderator:read:chatters"];

const twitchBot = new Hono();

function buildRedirectUri() {
  return new URL("/api/oauth/twitch-bot/callback", env.BETTER_AUTH_URL).toString();
}

async function requireBroadcaster(headers: Headers): Promise<{ userId: string } | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;
  const rows = await db
    .select({ role: userMeta.role })
    .from(userMeta)
    .where(eq(userMeta.userId, session.user.id))
    .limit(1);
  if (rows[0]?.role !== "broadcaster") return null;
  return { userId: session.user.id };
}

twitchBot.get("/start", async (c) => {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return c.json({ error: "TWITCH_CLIENT_ID/SECRET not configured" }, 503);
  }
  const auth = await requireBroadcaster(c.req.raw.headers);
  if (!auth) return c.json({ error: "broadcaster only" }, 403);

  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", buildRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("force_verify", "true");
  return c.redirect(url.toString());
});

twitchBot.get("/callback", async (c) => {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return c.json({ error: "TWITCH_CLIENT_ID/SECRET not configured" }, 503);
  }
  const principal = await requireBroadcaster(c.req.raw.headers);
  if (!principal) return c.json({ error: "broadcaster only" }, 403);

  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !cookieState || state !== cookieState) {
    return c.json({ error: "invalid state" }, 400);
  }

  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: buildRedirectUri(),
  });
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    return c.json({ error: "token exchange failed", status: tokenRes.status }, 502);
  }
  const tok = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
    token_type: string;
  };

  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    },
  });
  let accountId: string | null = null;
  let accountLogin: string | null = null;
  if (userRes.ok) {
    const data = (await userRes.json()) as { data: Array<{ id: string; login: string }> };
    accountId = data.data[0]?.id ?? null;
    accountLogin = data.data[0]?.login ?? null;
  }

  const expiresAt = new Date(Date.now() + tok.expires_in * 1000);
  const values = {
    purpose: "twitch_bot" as const,
    accessCiphertext: encrypt(tok.access_token),
    refreshCiphertext: encrypt(tok.refresh_token),
    scope: tok.scope.join(" "),
    accountId,
    accountLogin,
    expiresAt,
  };
  await db
    .insert(oauthTokens)
    .values(values)
    .onConflictDoUpdate({ target: oauthTokens.purpose, set: values });

  await db.insert(auditLogs).values({
    actorUserId: principal.userId,
    action: "setup.twitch_bot_linked",
    targetType: "oauth_tokens",
    targetId: "twitch_bot",
    payload: { accountId, accountLogin },
  });

  const back = new URL("/setup", env.CORS_ORIGIN);
  back.searchParams.set("step", "3");
  back.searchParams.set("twitch_bot", "linked");
  return c.redirect(back.toString());
});

export default twitchBot;
