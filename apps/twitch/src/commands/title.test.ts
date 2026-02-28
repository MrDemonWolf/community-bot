import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getTitle: vi.fn(),
}));

vi.mock("../services/streamStatusManager.js", () => ({
  getTitle: mocks.getTitle,
}));

import { title } from "./title.js";

function makeMockMsg() {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod: false, isBroadcaster: false },
  } as any;
}

describe("title command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("shows current title when available", async () => {
    mocks.getTitle.mockReturnValue("Playing some game!");
    await title.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "Current title: Playing some game!");
  });

  it("shows fallback when no title", async () => {
    mocks.getTitle.mockReturnValue("");
    await title.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@testuser, no title set or stream is offline.");
  });
});
