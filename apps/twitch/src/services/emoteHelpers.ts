const cache = new Map<string, { data: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCache(key: string, data: string): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

function truncate(text: string, max = 400): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export async function get7TVEmotes(twitchUserId: string): Promise<string> {
  const cacheKey = `7tv:${twitchUserId}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`https://7tv.io/v3/users/twitch/${twitchUserId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "(7TV emotes unavailable)";
    const data = (await res.json()) as {
      emote_set?: { emotes?: Array<{ name: string }> };
    };
    const names = data.emote_set?.emotes?.map((e) => e.name).join(" ") ?? "";
    const result = truncate(names) || "(no 7TV emotes)";
    setCache(cacheKey, result);
    return result;
  } catch {
    return "(7TV emotes unavailable)";
  }
}

export async function getBTTVEmotes(twitchUserId: string): Promise<string> {
  const cacheKey = `bttv:${twitchUserId}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(
      `https://api.betterttv.net/3/cached/users/twitch/${twitchUserId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return "(BTTV emotes unavailable)";
    const data = (await res.json()) as {
      sharedEmotes?: Array<{ code: string }>;
      channelEmotes?: Array<{ code: string }>;
    };
    const emotes = [
      ...(data.channelEmotes ?? []),
      ...(data.sharedEmotes ?? []),
    ];
    const names = emotes.map((e) => e.code).join(" ");
    const result = truncate(names) || "(no BTTV emotes)";
    setCache(cacheKey, result);
    return result;
  } catch {
    return "(BTTV emotes unavailable)";
  }
}

export async function getFFZEmotes(twitchUserId: string): Promise<string> {
  const cacheKey = `ffz:${twitchUserId}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(
      `https://api.frankerfacez.com/v1/room/id/${twitchUserId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return "(FFZ emotes unavailable)";
    const data = (await res.json()) as {
      sets: Record<string, { emoticons: Array<{ name: string }> }>;
    };
    const names = Object.values(data.sets)
      .flatMap((s) => s.emoticons.map((e) => e.name))
      .join(" ");
    const result = truncate(names) || "(no FFZ emotes)";
    setCache(cacheKey, result);
    return result;
  } catch {
    return "(FFZ emotes unavailable)";
  }
}
