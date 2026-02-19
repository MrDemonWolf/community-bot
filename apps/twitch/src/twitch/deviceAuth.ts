import consola from "consola";
import { env } from "../utils/env.js";

const DEVICE_CODE_URL = "https://id.twitch.tv/oauth2/device";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const SCOPES = "chat:read chat:edit moderator:read:followers channel:read:subscriptions";

export interface DeviceFlowTokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string[];
}

interface DeviceCodeResponse {
  device_code: string;
  expires_in: number;
  interval: number;
  user_code: string;
  verification_uri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  scope?: string[];
  message?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDeviceCodeFlow(): Promise<DeviceFlowTokenData> {
  // Request a device code
  const deviceRes = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_APPLICATION_CLIENT_ID,
      scopes: SCOPES,
    }),
  });

  if (!deviceRes.ok) {
    const text = await deviceRes.text();
    throw new Error(`Failed to start device authorization: ${deviceRes.status} — ${text}`);
  }

  const { device_code, expires_in, interval, user_code, verification_uri } =
    (await deviceRes.json()) as DeviceCodeResponse;

  // Show instructions — if the URL already has the code, just show the link
  const hasCodeInUrl = verification_uri.includes(user_code);
  const instructions = hasCodeInUrl
    ? `Authorize the bot:\n\n  ${verification_uri}\n\nOpen the link above and approve access.`
    : `Authorize the bot:\n\n  1. Go to: ${verification_uri}\n  2. Enter code: ${user_code}`;

  consola.box(instructions);

  // Poll for authorization
  const pollMs = (interval || 5) * 1000;
  const deadline = Date.now() + expires_in * 1000;
  let dots = 0;

  while (Date.now() < deadline) {
    await sleep(pollMs);
    dots = (dots + 1) % 4;
    process.stdout.write(`\r  Waiting for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}  `);

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.TWITCH_APPLICATION_CLIENT_ID,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const body = (await tokenRes.json()) as TokenResponse;

    if (tokenRes.ok) {
      process.stdout.write("\r" + " ".repeat(40) + "\r");
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in ?? 0,
        scope: body.scope ?? [],
      };
    }

    const err = body?.message || body?.error || "";
    if (err === "authorization_pending") continue;
    if (err === "slow_down") {
      await sleep(pollMs);
      continue;
    }

    process.stdout.write("\r" + " ".repeat(40) + "\r");
    throw new Error(`Authorization failed: ${JSON.stringify(body)}`);
  }

  process.stdout.write("\r" + " ".repeat(40) + "\r");
  throw new Error("Authorization timed out — restart the bot to try again.");
}
