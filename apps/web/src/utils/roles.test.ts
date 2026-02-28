import { describe, it, expect } from "vitest";
import { getRoleDisplay, ROLE_DISPLAY } from "./roles";

describe("getRoleDisplay", () => {
  it("returns BROADCASTER display", () => {
    const result = getRoleDisplay("BROADCASTER");
    expect(result.label).toBe("Broadcaster");
    expect(result.className).toContain("brand-main");
  });

  it("returns MODERATOR display", () => {
    const result = getRoleDisplay("MODERATOR");
    expect(result.label).toBe("Moderator");
  });

  it("returns LEAD_MODERATOR display", () => {
    const result = getRoleDisplay("LEAD_MODERATOR");
    expect(result.label).toBe("Lead Mod");
  });

  it("returns USER display for unknown role", () => {
    const result = getRoleDisplay("UNKNOWN_ROLE");
    expect(result.label).toBe("User");
  });

  it("returns BROADCASTER display when USER is channel owner", () => {
    const result = getRoleDisplay("USER", true);
    expect(result.label).toBe("Broadcaster");
    expect(result.className).toContain("brand-main");
  });

  it("returns normal USER display when not channel owner", () => {
    const result = getRoleDisplay("USER", false);
    expect(result.label).toBe("User");
  });

  it("does not override non-USER roles with isChannelOwner", () => {
    const result = getRoleDisplay("BROADCASTER", true);
    expect(result.label).toBe("Broadcaster");
  });

  it("ROLE_DISPLAY has all expected roles", () => {
    expect(ROLE_DISPLAY).toHaveProperty("BROADCASTER");
    expect(ROLE_DISPLAY).toHaveProperty("LEAD_MODERATOR");
    expect(ROLE_DISPLAY).toHaveProperty("MODERATOR");
    expect(ROLE_DISPLAY).toHaveProperty("USER");
  });
});
