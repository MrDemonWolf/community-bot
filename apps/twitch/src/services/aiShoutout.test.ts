import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  helixFetch: vi.fn(),
  env: {
    GEMINI_API_KEY: "test-gemini-key",
    AI_SHOUTOUT_ENABLED: "true",
    TWITCH_APPLICATION_CLIENT_ID: "test-client-id",
    TWITCH_APPLICATION_CLIENT_SECRET: "test-secret",
    DATABASE_URL: "postgres://test",
    REDIS_URL: "redis://localhost",
  },
}));

vi.mock("./helixClient.js", () => ({
  helixFetch: mocks.helixFetch,
}));
vi.mock("../utils/env.js", () => ({
  env: mocks.env,
}));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { generateShoutout, isAiShoutoutGloballyEnabled } from "./aiShoutout.js";

describe("aiShoutout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    // Reset env to defaults
    mocks.env.GEMINI_API_KEY = "test-gemini-key";
    mocks.env.AI_SHOUTOUT_ENABLED = "true";
  });

  describe("isAiShoutoutGloballyEnabled", () => {
    it("returns true when both env vars are set", () => {
      expect(isAiShoutoutGloballyEnabled()).toBe(true);
    });

    it("returns false when GEMINI_API_KEY is missing", () => {
      mocks.env.GEMINI_API_KEY = "";
      expect(isAiShoutoutGloballyEnabled()).toBe(false);
    });

    it("returns false when AI_SHOUTOUT_ENABLED is not true", () => {
      mocks.env.AI_SHOUTOUT_ENABLED = "false";
      expect(isAiShoutoutGloballyEnabled()).toBe(false);
    });
  });

  describe("generateShoutout", () => {
    it("returns AI-generated message on success", async () => {
      // Mock Helix API calls
      mocks.helixFetch
        .mockResolvedValueOnce({
          data: [{ id: "123", login: "target", display_name: "Target", description: "Cool streamer" }],
        })
        .mockResolvedValueOnce({
          data: [{ game_name: "Fortnite", title: "Fun stream!" }],
        })
        .mockResolvedValueOnce({ total: 5000, data: [] }) // followers
        .mockResolvedValueOnce({ data: [{ title: "Epic clip" }] }); // clips

      // Mock Gemini API
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: "Target is an amazing Fortnite player! Go check them out!" }],
                },
              },
            ],
          }),
      });

      const result = await generateShoutout("target");

      expect(result).toBe("Target is an amazing Fortnite player! Go check them out!");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("generativelanguage.googleapis.com"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("returns null when streamer not found", async () => {
      mocks.helixFetch.mockResolvedValueOnce({ data: [] });

      const result = await generateShoutout("nobody");
      expect(result).toBeNull();
    });

    it("returns null when Gemini API fails", async () => {
      mocks.helixFetch
        .mockResolvedValueOnce({
          data: [{ id: "123", login: "target", display_name: "Target", description: "" }],
        })
        .mockResolvedValueOnce({ data: [{ game_name: "", title: "" }] })
        .mockResolvedValueOnce({ total: 0, data: [] })
        .mockResolvedValueOnce({ data: [] });

      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await generateShoutout("target2");
      expect(result).toBeNull();
    });

    it("returns null when GEMINI_API_KEY is not set", async () => {
      mocks.env.GEMINI_API_KEY = "";

      mocks.helixFetch
        .mockResolvedValueOnce({
          data: [{ id: "123", login: "target", display_name: "Target", description: "" }],
        })
        .mockResolvedValueOnce({ data: [{ game_name: "", title: "" }] })
        .mockResolvedValueOnce({ total: 0, data: [] })
        .mockResolvedValueOnce({ data: [] });

      const result = await generateShoutout("target3");
      expect(result).toBeNull();
    });

    it("uses cache for repeated calls", async () => {
      // First call - set up mocks
      mocks.helixFetch
        .mockResolvedValueOnce({
          data: [{ id: "123", login: "cached", display_name: "Cached", description: "" }],
        })
        .mockResolvedValueOnce({ data: [{ game_name: "Chess", title: "" }] })
        .mockResolvedValueOnce({ total: 100, data: [] })
        .mockResolvedValueOnce({ data: [] });

      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: "Cached shoutout!" }] } }],
          }),
      });

      const result1 = await generateShoutout("cached");
      expect(result1).toBe("Cached shoutout!");

      // Second call should use cache
      vi.clearAllMocks();
      const result2 = await generateShoutout("cached");
      expect(result2).toBe("Cached shoutout!");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
