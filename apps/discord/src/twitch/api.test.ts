import { describe, it, expect, vi } from "vitest";

vi.mock("@community-bot/db", () => ({
  prisma: { twitchCredential: { findFirst: vi.fn() } },
}));

vi.mock("../utils/env.js", () => ({
  default: { TWITCH_APPLICATION_CLIENT_ID: "test" },
}));

vi.mock("../utils/logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { getStreamThumbnailUrl } from "./api.js";

describe("getStreamThumbnailUrl", () => {
  const template = "https://static-cdn.jtvnw.net/previews-ttv/live_user_test-{width}x{height}.jpg";

  it("replaces placeholders with default dimensions", () => {
    const result = getStreamThumbnailUrl(template);
    expect(result).toBe(
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_test-1280x720.jpg"
    );
  });

  it("replaces placeholders with custom dimensions", () => {
    const result = getStreamThumbnailUrl(template, 640, 360);
    expect(result).toBe(
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_test-640x360.jpg"
    );
  });

  it("returns string unchanged when no placeholders present", () => {
    const url = "https://example.com/image.jpg";
    expect(getStreamThumbnailUrl(url)).toBe(url);
  });
});
