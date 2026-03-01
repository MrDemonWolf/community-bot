/**
 * YouTube Data API v3 lookup for the web dashboard.
 *
 * Used when adding playlist entries to fetch video metadata.
 */

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
  channelName: string;
}

function extractVideoId(input: string): string | null {
  const match = input.match(
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || "0", 10) * 3600 +
    parseInt(match[2] || "0", 10) * 60 +
    parseInt(match[3] || "0", 10)
  );
}

async function fetchVideoById(
  videoId: string,
  apiKey: string
): Promise<YouTubeVideoInfo | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  return {
    videoId: item.id,
    title: item.snippet.title,
    duration: parseDuration(item.contentDetails.duration),
    thumbnail:
      item.snippet.thumbnails?.medium?.url ??
      item.snippet.thumbnails?.default?.url ??
      "",
    channelName: item.snippet.channelTitle,
  };
}

async function searchVideo(
  query: string,
  apiKey: string
): Promise<YouTubeVideoInfo | null> {
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const searchItem = searchData.items?.[0];
  if (!searchItem) return null;

  return fetchVideoById(searchItem.id.videoId, apiKey);
}

/**
 * Look up a YouTube video by URL or search query.
 */
export async function lookupVideo(
  query: string,
  apiKey: string
): Promise<YouTubeVideoInfo | null> {
  try {
    const videoId = extractVideoId(query);
    return videoId
      ? await fetchVideoById(videoId, apiKey)
      : await searchVideo(query, apiKey);
  } catch {
    return null;
  }
}
