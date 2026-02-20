import { describe, it, expect } from "vitest";
import { truncate } from "./emoteHelpers.js";

describe("truncate", () => {
  it("returns text unchanged when under limit", () => {
    expect(truncate("hello")).toBe("hello");
  });

  it("returns text unchanged when exactly at limit", () => {
    const text = "a".repeat(400);
    expect(truncate(text)).toBe(text);
  });

  it("truncates and appends '...' when over limit", () => {
    const text = "a".repeat(401);
    expect(truncate(text)).toBe("a".repeat(400) + "...");
  });

  it("respects custom max parameter", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });

  it("handles empty string", () => {
    expect(truncate("")).toBe("");
  });
});
