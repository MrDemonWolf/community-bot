import { createSign } from "node:crypto";

import { env } from "../utils/env.js";

const cache = new Map<string, { data: string; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function isConfigured(): boolean {
  return !!(
    env.APPLE_WEATHERKIT_KEY_ID &&
    env.APPLE_WEATHERKIT_TEAM_ID &&
    env.APPLE_WEATHERKIT_SERVICE_ID &&
    env.APPLE_WEATHERKIT_PRIVATE_KEY
  );
}

function base64url(input: string | Buffer): string {
  const b64 = Buffer.from(input).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createWeatherKitJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "ES256",
    kid: env.APPLE_WEATHERKIT_KEY_ID!,
    id: `${env.APPLE_WEATHERKIT_TEAM_ID!}.${env.APPLE_WEATHERKIT_SERVICE_ID!}`,
  };
  const payload = {
    iss: env.APPLE_WEATHERKIT_TEAM_ID!,
    iat: now,
    exp: now + 3600,
    sub: env.APPLE_WEATHERKIT_SERVICE_ID!,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = createSign("SHA256");
  sign.update(signingInput);
  const signature = sign.sign(env.APPLE_WEATHERKIT_PRIVATE_KEY!, "base64");
  const signatureB64 = signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${signatureB64}`;
}

async function geocode(
  location: string
): Promise<{ lat: number; lng: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://geocode.maps.apple.com/v1/geocode?q=${encodeURIComponent(location)}&lang=en`,
      {
        headers: { Authorization: `Bearer ${createWeatherKitJWT()}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        coordinate: { latitude: number; longitude: number };
        displayLines?: string[];
      }>;
    };
    const result = data.results?.[0];
    if (!result) return null;
    return {
      lat: result.coordinate.latitude,
      lng: result.coordinate.longitude,
      name: result.displayLines?.join(", ") ?? location,
    };
  } catch {
    return null;
  }
}

export async function getWeather(location: string): Promise<string> {
  if (!isConfigured()) return "(weather not configured)";

  const trimmed = location.trim();
  if (!trimmed) return "(no location provided)";

  const cacheKey = `weather:${trimmed.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const geo = await geocode(trimmed);
    if (!geo) return "(location not found)";

    const token = createWeatherKitJWT();
    const res = await fetch(
      `https://weatherkit.apple.com/api/v1/weather/en/${geo.lat}/${geo.lng}?dataSets=currentWeather`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return "(weather unavailable)";

    const data = (await res.json()) as {
      currentWeather?: {
        temperature: number;
        conditionCode: string;
      };
    };

    const cw = data.currentWeather;
    if (!cw) return "(weather data unavailable)";

    const tempF = Math.round(cw.temperature * 9 / 5 + 32);
    const condition = cw.conditionCode
      .replace(/([A-Z])/g, " $1")
      .trim();
    const result = `${tempF}\u00B0F, ${condition} in ${geo.name} (Apple Weather)`;

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch {
    return "(weather error)";
  }
}
