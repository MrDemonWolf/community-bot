import { randomBytes } from "node:crypto";

import { auth } from "@community-bot/auth";
import { encrypt } from "@community-bot/db/crypto";
import { updateSettings } from "@community-bot/db/settings";
import { env } from "@community-bot/env/server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

// Custom Twitch OAuth (separate from dashboard login): connects the broadcaster
// account (read scopes) and the wolfaid bot account (chat:read/chat:edit), then
// stores encrypted token bundles in the settings row for the chat worker (M0.3).
//
// One Twitch app, two logins. Redirect URI must match the app exactly:
//   <BETTER_AUTH_URL>/twitch/callback

type Role = "broadcaster" | "bot";

const SCOPES: Record<Role, string> = {
  broadcaster: "user:read:email channel:read:subscriptions moderator:read:followers",
  bot: "chat:read chat:edit",
};

const REDIRECT_URI = `${env.BETTER_AUTH_URL}/twitch/callback`;
const STATE_COOKIE = "twitch_oauth_state";

function appConfigured() {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}

export const twitchOAuth = new Hono();

// Step 1 — kick off OAuth for a role. Top-level nav sends the session cookie.
twitchOAuth.get("/connect/:role", async (c) => {
  const role = c.req.param("role") as Role;
  if (role !== "broadcaster" && role !== "bot") return c.text("bad role", 400);
  if (!appConfigured()) return c.text("Twitch app not configured (set TWITCH_CLIENT_ID/SECRET)", 503);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.text("unauthorized", 401);

  const nonce = randomBytes(16).toString("hex");
  setCookie(c, STATE_COOKIE, `${role}:${nonce}`, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", env.TWITCH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES[role]);
  url.searchParams.set("state", `${role}:${nonce}`);
  url.searchParams.set("force_verify", "true"); // let user pick the right account
  return c.redirect(url.toString());
});

// Step 2 — Twitch redirects back here with code + state.
twitchOAuth.get("/callback", async (c) => {
  if (!appConfigured()) return c.text("Twitch app not configured", 503);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.text("unauthorized", 401);

  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !cookieState || state !== cookieState) {
    return c.text("invalid oauth state", 400);
  }
  const role = state.split(":")[0] as Role;

  // Exchange code → tokens
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID!,
      client_secret: env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) return c.text(`token exchange failed: ${await tokenRes.text()}`, 502);
  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
  };

  // Identify the account
  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Client-Id": env.TWITCH_CLIENT_ID!,
    },
  });
  if (!userRes.ok) return c.text(`user fetch failed: ${await userRes.text()}`, 502);
  const tUser = ((await userRes.json()) as { data: { id: string; login: string }[] }).data[0];
  if (!tUser) return c.text("no twitch user returned", 502);

  const bundle = encrypt(
    JSON.stringify({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      scopes: token.scope,
    }),
  );

  await updateSettings(
    role === "broadcaster"
      ? {
          broadcasterUserId: tUser.id,
          broadcasterLogin: tUser.login,
          broadcasterTokenEnc: bundle,
        }
      : { botUserId: tUser.id, botLogin: tUser.login, botTokenEnc: bundle },
  );

  return c.redirect(`${env.CORS_ORIGIN}/setup?connected=${role}`);
});
