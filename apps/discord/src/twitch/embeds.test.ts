import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/env.js", () => ({
  default: { NODE_ENV: "test" },
}));

vi.mock("./api.js", () => ({
  getStreamThumbnailUrl: (url: string) => url,
}));

import { formatDuration } from "./embeds.js";

describe("embeds", () => {
  describe("formatDuration", () => {
    it("formats minutes only", () => {
      expect(formatDuration(5 * 60_000)).toBe("5m");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(90 * 60_000)).toBe("1h 30m");
    });

    it("formats exact hours", () => {
      expect(formatDuration(120 * 60_000)).toBe("2h 0m");
    });

    it("formats zero duration", () => {
      expect(formatDuration(0)).toBe("0m");
    });

    it("formats large durations", () => {
      expect(formatDuration(10 * 3600_000 + 45 * 60_000)).toBe("10h 45m");
    });

    it("truncates partial minutes", () => {
      expect(formatDuration(5 * 60_000 + 30_000)).toBe("5m");
    });
  });
});
