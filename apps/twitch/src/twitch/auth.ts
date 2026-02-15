import { RefreshingAuthProvider } from "@twurple/auth";

import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { prisma } from "@community-bot/db";

const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

export interface AuthResult {
  authProvider: RefreshingAuthProvider;
  botUsername: string;
}

interface ValidateResult {
  login: string;
  user_id: string;
}

function tokenToDb(userId: string, token: { accessToken: string; refreshToken: string; expiresIn: number; obtainmentTimestamp: number; scope: string[] }) {
  return prisma.twitchCredential.upsert({
    where: { userId },
    update: {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresIn: token.expiresIn,
      obtainmentTimestamp: BigInt(token.obtainmentTimestamp),
      scope: token.scope,
    },
    create: {
      userId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresIn: token.expiresIn,
      obtainmentTimestamp: BigInt(token.obtainmentTimestamp),
      scope: token.scope,
    },
  });
}

async function validateToken(accessToken: string): Promise<ValidateResult | null> {
  const res = await fetch(VALIDATE_URL, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { login: string; user_id: string };
  return { login: data.login, user_id: data.user_id };
}

async function refreshToken(refreshTokenStr: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
} | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenStr,
      client_id: env.TWITCH_APPLICATION_CLIENT_ID,
      client_secret: env.TWITCH_APPLICATION_CLIENT_SECRET,
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
  };
}

export async function createAuthProvider(): Promise<AuthResult> {
  const authProvider = new RefreshingAuthProvider({
    clientId: env.TWITCH_APPLICATION_CLIENT_ID,
    clientSecret: env.TWITCH_APPLICATION_CLIENT_SECRET,
  });

  // Auto-persist refreshed tokens to the database
  authProvider.onRefresh(async (userId, tokenData) => {
    await tokenToDb(userId, {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken ?? "",
      expiresIn: tokenData.expiresIn ?? 0,
      obtainmentTimestamp: tokenData.obtainmentTimestamp,
      scope: tokenData.scope,
    });
    logger.twitch.tokenRefreshed(userId);
  });

  // 1. Try stored credentials from DB
  const stored = await prisma.twitchCredential.findFirst();

  if (stored) {
    // Validate the stored access token
    let validated = await validateToken(stored.accessToken);

    if (validated) {
      logger.success("Twitch Auth", `Loaded valid credentials for ${validated.login}`);
      authProvider.addUser(stored.userId, {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        expiresIn: stored.expiresIn,
        obtainmentTimestamp: Number(stored.obtainmentTimestamp),
        scope: stored.scope,
      }, ["chat"]);
      return { authProvider, botUsername: validated.login };
    }

    // Access token expired — try refreshing
    logger.warn("Twitch Auth", "Stored token expired, attempting refresh...");
    const refreshed = await refreshToken(stored.refreshToken);

    if (refreshed) {
      const now = Date.now();
      validated = await validateToken(refreshed.access_token);
      const login = validated?.login ?? stored.userId;

      await tokenToDb(stored.userId, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresIn: refreshed.expires_in,
        obtainmentTimestamp: now,
        scope: refreshed.scope,
      });

      authProvider.addUser(stored.userId, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresIn: refreshed.expires_in,
        obtainmentTimestamp: now,
        scope: refreshed.scope,
      }, ["chat"]);

      logger.success("Twitch Auth", `Token refreshed successfully for ${login}`);
      return { authProvider, botUsername: login };
    }

    // Refresh failed — token is dead, delete it
    logger.warn("Twitch Auth", "Refresh failed, removing stale credentials");
    await prisma.twitchCredential.delete({ where: { id: stored.id } });
  }

  // 2. No valid credentials — setup wizard must be completed first
  logger.warn("Twitch Auth", "No credentials found. Complete the setup wizard in the web dashboard.");
  throw new Error("No Twitch credentials. Run the setup wizard.");
}
