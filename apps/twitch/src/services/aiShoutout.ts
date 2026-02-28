/**
 * AI-Enhanced Shoutout — Generates personalized shoutout messages
 * using Google Gemini, based on the target streamer's Twitch profile.
 */
import { helixFetch } from "./helixClient.js";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

interface StreamerProfile {
  displayName: string;
  login: string;
  description: string;
  gameName: string;
  title: string;
  followerCount: number;
  topClips: string[];
}

// 30-second per-user cache to prevent spam
const cache = new Map<string, { message: string; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

async function fetchStreamerProfile(username: string): Promise<StreamerProfile | null> {
  try {
    // Look up user
    const userRes = await helixFetch<{
      id: string;
      login: string;
      display_name: string;
      description: string;
    }>("users", { login: username.toLowerCase() });
    const user = userRes.data[0];
    if (!user) return null;

    // Get channel info
    const channelRes = await helixFetch<{
      game_name: string;
      title: string;
    }>("channels", { broadcaster_id: user.id });
    const channel = channelRes.data[0];

    // Get follower count
    let followerCount = 0;
    try {
      const followRes = await helixFetch<unknown>("channels/followers", {
        broadcaster_id: user.id,
      });
      const raw = followRes as unknown as { total?: number };
      followerCount = raw.total ?? 0;
    } catch {
      // Follower count is optional
    }

    // Get top clips
    const topClips: string[] = [];
    try {
      const clipRes = await helixFetch<{ title: string }>("clips", {
        broadcaster_id: user.id,
        first: "3",
      });
      for (const clip of clipRes.data) {
        topClips.push(clip.title);
      }
    } catch {
      // Clips are optional
    }

    return {
      displayName: user.display_name,
      login: user.login,
      description: user.description || "",
      gameName: channel?.game_name || "",
      title: channel?.title || "",
      followerCount,
      topClips,
    };
  } catch {
    return null;
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.8,
          },
        }),
      }
    );

    if (!res.ok) {
      logger.warn("AIShoutout", `Gemini API error: ${res.status}`);
      return null;
    }

    const body = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    return body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("AIShoutout", "Gemini API request timed out (5s)");
    } else {
      logger.warn(
        "AIShoutout",
        "Gemini API error",
        err instanceof Error ? { error: err.message } : undefined
      );
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate a personalized AI shoutout for a target streamer.
 * Returns null if AI is unavailable or fails (regular shoutout still works).
 */
export async function generateShoutout(targetUsername: string): Promise<string | null> {
  // Check cache
  const cached = cache.get(targetUsername.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return cached.message;
  }

  const profile = await fetchStreamerProfile(targetUsername);
  if (!profile) return null;

  const clipsSection = profile.topClips.length > 0
    ? `Top clips: ${profile.topClips.join(", ")}.`
    : "";

  const prompt = `You are a friendly Twitch chat bot. Write a brief, fun, personalized shoutout for this streamer in 1-2 sentences. Keep it Twitch-appropriate, enthusiastic, and under 250 characters.

Streamer: ${profile.displayName}
Description: ${profile.description || "N/A"}
Last game: ${profile.gameName || "N/A"}
Stream title: ${profile.title || "N/A"}
Followers: ${profile.followerCount}
${clipsSection}

Write ONLY the shoutout message, no quotes or prefixes.`;

  const message = await callGemini(prompt);
  if (!message) return null;

  // Cache the result
  cache.set(targetUsername.toLowerCase(), {
    message,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return message;
}

/** Check if AI shoutout is globally enabled via env var. */
export function isAiShoutoutGloballyEnabled(): boolean {
  return env.AI_SHOUTOUT_ENABLED === "true" && !!env.GEMINI_API_KEY;
}
