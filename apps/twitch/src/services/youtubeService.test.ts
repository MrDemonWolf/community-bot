import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { YOUTUBE_API_KEY: "test-key" } as Record<string, string | undefined>,
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../utils/env.js", () => ({ env: mocks.env }));
vi.mock("../utils/logger.js", () => ({ logger: mocks.logger }));

import {
  extractVideoId,
  parseDuration,
  formatDuration,
  isYouTubeEnabled,
  lookupVideo,
} from "./youtubeService.js";

const mockVideoResponse = {
  items: [
    {
      id: "dQw4w9WgXcQ",
      snippet: {
        title: "Test Video",
        channelTitle: "Test Channel",
        thumbnails: {
          medium: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg" },
          default: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg" },
        },
      },
      contentDetails: {
        duration: "PT4M33S",
      },
    },
  ],
};

const mockSearchResponse = {
  items: [
    {
      id: { videoId: "dQw4w9WgXcQ" },
      snippet: {
        title: "Test Video",
        channelTitle: "Test Channel",
      },
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.env.YOUTUBE_API_KEY = "test-key";
});

// ---------------------------------------------------------------------------
// extractVideoId
// ---------------------------------------------------------------------------
describe("extractVideoId", () => {
  it("extracts ID from youtube.com/watch?v= URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts ID from youtube.com/watch URL with extra params", () => {
    expect(
      extractVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLabc",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be/ short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts ID from youtube.com/shorts/ URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube input", () => {
    expect(extractVideoId("hello world")).toBeNull();
  });

  it("returns null for other URLs", () => {
    expect(extractVideoId("https://example.com/watch?v=abc")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractVideoId("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDuration
// ---------------------------------------------------------------------------
describe("parseDuration", () => {
  it("parses PT4M33S correctly", () => {
    expect(parseDuration("PT4M33S")).toBe(4 * 60 + 33);
  });

  it("parses PT1H2M3S correctly", () => {
    expect(parseDuration("PT1H2M3S")).toBe(3600 + 120 + 3);
  });

  it("parses PT30S (seconds only)", () => {
    expect(parseDuration("PT30S")).toBe(30);
  });

  it("parses PT5M (minutes only, no seconds)", () => {
    expect(parseDuration("PT5M")).toBe(300);
  });

  it("parses PT2H (hours only)", () => {
    expect(parseDuration("PT2H")).toBe(7200);
  });

  it("returns 0 for invalid input", () => {
    expect(parseDuration("invalid")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseDuration("")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe("formatDuration", () => {
  it("formats seconds to MM:SS", () => {
    expect(formatDuration(273)).toBe("4:33");
  });

  it("formats with zero-padded seconds", () => {
    expect(formatDuration(61)).toBe("1:01");
  });

  it("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats hours as H:MM:SS", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("formats exact hour as H:MM:SS", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
  });
});

// ---------------------------------------------------------------------------
// isYouTubeEnabled
// ---------------------------------------------------------------------------
describe("isYouTubeEnabled", () => {
  it("returns true when YOUTUBE_API_KEY is set", () => {
    expect(isYouTubeEnabled()).toBe(true);
  });

  it("returns false when YOUTUBE_API_KEY is undefined", () => {
    mocks.env.YOUTUBE_API_KEY = undefined;
    expect(isYouTubeEnabled()).toBe(false);
  });

  it("returns false when YOUTUBE_API_KEY is empty string", () => {
    mocks.env.YOUTUBE_API_KEY = "";
    expect(isYouTubeEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lookupVideo
// ---------------------------------------------------------------------------
describe("lookupVideo", () => {
  beforeEach(() => {
    // Clear the internal module cache between tests by looking up a unique query
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns null when YouTube is not enabled", async () => {
    mocks.env.YOUTUBE_API_KEY = undefined;
    const result = await lookupVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches video by ID when given a YouTube URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockVideoResponse),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await lookupVideo(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    expect(result).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Test Video",
      duration: 273,
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      channelName: "Test Channel",
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain(
      "googleapis.com/youtube/v3/videos",
    );
  });

  it("falls back to search when input is not a YouTube URL", async () => {
    const mockFetch = vi
      .fn()
      // First call: search
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      })
      // Second call: video details
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVideoResponse),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await lookupVideo("test search query");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Test Video");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain(
      "googleapis.com/youtube/v3/search",
    );
    expect(mockFetch.mock.calls[1][0]).toContain(
      "googleapis.com/youtube/v3/videos",
    );
  });

  it("returns cached result on repeated lookup", async () => {
    const uniqueUrl = "https://www.youtube.com/watch?v=CACHE_TEST1";
    const cacheResponse = {
      items: [
        {
          id: "CACHE_TEST1",
          snippet: {
            title: "Cached Video",
            channelTitle: "Cached Channel",
            thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
          },
          contentDetails: { duration: "PT1M" },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(cacheResponse),
    });
    vi.stubGlobal("fetch", mockFetch);

    const first = await lookupVideo(uniqueUrl);
    const second = await lookupVideo(uniqueUrl);

    expect(first).toEqual(second);
    // fetch should only be called once — second call uses cache
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns null when API returns non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await lookupVideo(
      "https://www.youtube.com/watch?v=APIERR_001",
    );
    expect(result).toBeNull();
  });

  it("returns null when API returns no items", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await lookupVideo(
      "https://www.youtube.com/watch?v=NORESULT01",
    );
    expect(result).toBeNull();
  });

  it("returns null and logs warning when fetch throws", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await lookupVideo(
      "https://www.youtube.com/watch?v=FETCHERR_1",
    );
    expect(result).toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalled();
  });
});
