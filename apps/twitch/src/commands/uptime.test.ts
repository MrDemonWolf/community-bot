import { describe, it, expect, vi } from "vitest";

vi.mock("../services/streamStatusManager.js", () => ({
  isLive: vi.fn(),
  getStreamStartedAt: vi.fn(),
  getWentOfflineAt: vi.fn(),
}));

import { formatDuration } from "./uptime.js";

describe("uptime formatDuration", () => {
  it("returns seconds for values under 1 minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("returns minutes only", () => {
    expect(formatDuration(5 * 60 * 1000)).toBe("5m");
  });

  it("returns hours and minutes", () => {
    expect(formatDuration(2 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe("2h 30m");
  });

  it("returns days, hours, and minutes", () => {
    const ms = 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000 + 10 * 60 * 1000;
    expect(formatDuration(ms)).toBe("3d 5h 10m");
  });

  it("returns days and hours when minutes are 0", () => {
    const ms = 1 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000;
    expect(formatDuration(ms)).toBe("1d 12h");
  });

  it("returns only days when hours and minutes are 0", () => {
    expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe("2d");
  });
});
