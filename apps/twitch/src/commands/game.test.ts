import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getGame: vi.fn(),
}));

vi.mock("../services/streamStatusManager.js", () => ({
  getGame: mocks.getGame,
}));

import { game } from "./game.js";

function makeMockMsg() {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod: false, isBroadcaster: false },
  } as any;
}

describe("game command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("shows current game when available", async () => {
    mocks.getGame.mockReturnValue("Just Chatting");
    await game.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "Current game: Just Chatting");
  });

  it("shows fallback when no game", async () => {
    mocks.getGame.mockReturnValue("");
    await game.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@testuser, no game set or stream is offline.");
  });
});
