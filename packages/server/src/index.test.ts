import { describe, it, expect } from "vitest";
import { skipHealthChecks } from "./index.js";

function makeRequest(overrides: { userAgent?: string; ip?: string } = {}) {
  return {
    get: (header: string) => {
      if (header === "User-Agent") return overrides.userAgent ?? "";
      return undefined;
    },
    ip: overrides.ip ?? "203.0.113.1",
    socket: { remoteAddress: overrides.ip ?? "203.0.113.1" },
  } as any;
}

describe("skipHealthChecks", () => {
  it("skips curl user-agent", () => {
    expect(skipHealthChecks(makeRequest({ userAgent: "curl/7.88.1" }))).toBe(true);
  });

  it("skips Pulsetic user-agent (case-insensitive)", () => {
    expect(skipHealthChecks(makeRequest({ userAgent: "Pulsetic/1.0" }))).toBe(true);
  });

  it("skips localhost IPv4", () => {
    expect(skipHealthChecks(makeRequest({ ip: "127.0.0.1" }))).toBe(true);
  });

  it("skips localhost IPv6", () => {
    expect(skipHealthChecks(makeRequest({ ip: "::1" }))).toBe(true);
  });

  it("skips IPv4-mapped IPv6 localhost", () => {
    expect(skipHealthChecks(makeRequest({ ip: "::ffff:127.0.0.1" }))).toBe(true);
  });

  it("does not skip normal requests", () => {
    expect(
      skipHealthChecks(
        makeRequest({ userAgent: "Mozilla/5.0", ip: "203.0.113.50" })
      )
    ).toBe(false);
  });
});
