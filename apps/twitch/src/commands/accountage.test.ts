import { describe, it, expect, vi } from "vitest";

vi.mock("../services/helixClient.js", () => ({
  helixFetch: vi.fn(),
}));

import { formatDuration } from "./accountage.js";

describe("accountage formatDuration", () => {
  it("returns 'less than an hour' for same date", () => {
    const d = new Date("2024-06-15T12:00:00Z");
    expect(formatDuration(d, d)).toBe("less than an hour");
  });

  it("returns hours for same day different hours", () => {
    const from = new Date("2024-06-15T10:00:00Z");
    const to = new Date("2024-06-15T15:00:00Z");
    expect(formatDuration(from, to)).toBe("5 hours");
  });

  it("returns days for a few days apart", () => {
    const from = new Date("2024-06-10T12:00:00Z");
    const to = new Date("2024-06-15T12:00:00Z");
    expect(formatDuration(from, to)).toBe("5 days");
  });

  it("returns months and days", () => {
    const from = new Date(2024, 0, 15, 12, 0, 0);
    const to = new Date(2024, 3, 20, 12, 0, 0);
    expect(formatDuration(from, to)).toBe("3 months 5 days");
  });

  it("returns years and months", () => {
    const from = new Date("2020-03-01T00:00:00Z");
    const to = new Date("2024-06-01T00:00:00Z");
    expect(formatDuration(from, to)).toMatch(/^4 years 3 months/);
  });

  it("handles singular forms", () => {
    const from = new Date("2023-05-14T12:00:00Z");
    const to = new Date("2024-06-15T12:00:00Z");
    expect(formatDuration(from, to)).toBe("1 year 1 month 1 day");
  });
});
