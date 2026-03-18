/**
 * Gemini-powered stream title generator.
 *
 * Calls gemini-2.0-flash to produce 3 Twitch stream title suggestions
 * based on branding and optional per-session context.
 */

interface GenerateTitlesInput {
  currentTitle: string;
  currentGame: string;
  brandingPrompt: string;
  userContext?: string;
}

// 30-second per-channel rate limit (in-memory)
const lastCall = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

export async function generateTitles(
  apiKey: string,
  botChannelId: string,
  input: GenerateTitlesInput
): Promise<{ titles: string[] }> {
  // Rate limit check
  const last = lastCall.get(botChannelId) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
    throw new Error(`Rate limited — try again in ${wait}s`);
  }

  const systemPrompt = `You are a creative Twitch stream title generator.
${input.brandingPrompt ? `Brand/style guide: ${input.brandingPrompt}` : ""}

Current title: ${input.currentTitle || "None"}
Current game: ${input.currentGame || "Not set"}
${input.userContext ? `Session context: ${input.userContext}` : ""}

Generate exactly 3 Twitch stream titles. Each must be under 140 characters.
Return ONLY a JSON array of 3 strings, no other text.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    lastCall.set(botChannelId, Date.now());

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.9,
          },
        }),
      }
    );

    if (!res.ok) {
      // Reset rate limit on failure so user can retry
      lastCall.delete(botChannelId);
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const raw =
      body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "[]";

    // Extract JSON array from the response (may be wrapped in markdown code block)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Gemini did not return a valid JSON array");
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Gemini returned an empty or invalid array");
    }

    // Ensure all entries are strings under 140 chars
    const titles = parsed
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.slice(0, 140))
      .slice(0, 3);

    if (titles.length === 0) {
      throw new Error("Gemini did not return valid title strings");
    }

    return { titles };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      lastCall.delete(botChannelId);
      throw new Error("Gemini API request timed out (8s)");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
