import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getFollowage: vi.fn(),
  getBroadcasterId: vi.fn(),
}));

vi.mock("../services/helixHelpers.js", () => ({
  getFollowage: mocks.getFollowage,
}));

vi.mock("../services/broadcasterCache.js", () => ({
  getBroadcasterId: mocks.getBroadcasterId,
}));

import { followage } from "./followage.js";

function makeMockMsg(userId = "456") {
  return {
    userInfo: { userId, displayName: "TestUser", isMod: false, isBroadcaster: false },
  } as any;
}

describe("followage command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("shows followage duration", async () => {
    mocks.getBroadcasterId.mockReturnValue("broadcaster-1");
    mocks.getFollowage.mockResolvedValue("2 years, 3 months");
    await followage.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(mocks.getFollowage).toHaveBeenCalledWith("broadcaster-1", "456");
    expect(say).toHaveBeenCalledWith("#channel", "@testuser has been following for 2 years, 3 months.");
  });

  it("shows error when broadcaster ID not found", async () => {
    mocks.getBroadcasterId.mockReturnValue(undefined);
    await followage.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@testuser, unable to look up followage.");
  });
});
