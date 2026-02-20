import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isValidUrl, delay } from "./filesay.js";

describe("isValidUrl", () => {
  it("accepts valid http URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("accepts valid https URL", () => {
    expect(isValidUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("rejects ftp protocol", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  it("rejects javascript protocol", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("rejects malformed URL", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });
});

describe("delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the specified timeout", async () => {
    const promise = delay(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });
});
