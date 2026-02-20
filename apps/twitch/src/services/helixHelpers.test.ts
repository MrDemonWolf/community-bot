import { describe, it, expect, vi } from "vitest";

vi.mock("./helixClient.js", () => ({
  helixFetch: vi.fn(),
}));

import { formatDuration } from "./helixHelpers.js";

describe("helixHelpers formatDuration", () => {
  it("returns minutes for small durations", () => {
    expect(formatDuration(5 * 60 * 1000)).toBe("5 minutes");
  });

  it("returns singular minute", () => {
    expect(formatDuration(60 * 1000)).toBe("1 minute");
  });

  it("returns hours for durations under a day", () => {
    expect(formatDuration(3 * 60 * 60 * 1000)).toBe("3 hours");
  });

  it("returns days for durations under a month", () => {
    const ms = 15 * 24 * 60 * 60 * 1000;
    expect(formatDuration(ms)).toBe("15 days");
  });

  it("returns months and days for multi-month durations", () => {
    // 45 days = 1 month 15 days
    const ms = 45 * 24 * 60 * 60 * 1000;
    expect(formatDuration(ms)).toBe("1 month, 15 days");
  });

  it("returns years and months for large durations", () => {
    // 400 days = 1 year, 1 month (approx with 365/30 day math)
    const ms = 400 * 24 * 60 * 60 * 1000;
    expect(formatDuration(ms)).toBe("1 year, 1 month");
  });

  it("limits output to 2 parts", () => {
    // 500 days = 1 year, 4 months, 15 days — should only show 2 parts
    const ms = 500 * 24 * 60 * 60 * 1000;
    const result = formatDuration(ms);
    expect(result.split(", ").length).toBeLessThanOrEqual(2);
  });

  it("returns 0 minutes for 0ms", () => {
    expect(formatDuration(0)).toBe("0 minutes");
  });
});
