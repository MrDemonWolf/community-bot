import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getRecentMessages: vi.fn(),
}));

vi.mock("../services/chatterTracker.js", () => ({
  getRecentMessages: mocks.getRecentMessages,
}));

import { nuke } from "./nuke.js";

function mockMsg(isMod: boolean, isBroadcaster = false) {
  return { userInfo: { isMod, isBroadcaster, userId: "u1" } } as any;
}

describe("nuke command", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-mods", async () => {
    const say = vi.fn();
    await nuke.execute({ say } as any, "#test", "user1", ["spam"], mockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage when no args", async () => {
    const say = vi.fn();
    await nuke.execute({ say } as any, "#test", "mod", [], mockMsg(true));
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("usage"));
  });

  it("timeouts users who said the phrase", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    mocks.getRecentMessages.mockReturnValue([
      { username: "spammer1", text: "buy spam now", timestamp: Date.now() },
      { username: "spammer2", text: "get free spam", timestamp: Date.now() },
      { username: "innocentuser", text: "hello world", timestamp: Date.now() },
    ]);

    await nuke.execute({ say } as any, "#test", "mod", ["spam"], mockMsg(true));

    // 2 timeout /say calls + 1 summary say
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("/timeout spammer1 300"));
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("/timeout spammer2 300"));
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("2 user(s)"));
  });

  it("uses custom timeout duration", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    mocks.getRecentMessages.mockReturnValue([
      { username: "spammer1", text: "buy spam now", timestamp: Date.now() },
    ]);

    await nuke.execute({ say } as any, "#test", "mod", ["spam", "600"], mockMsg(true));

    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("/timeout spammer1 600"));
  });

  it("does not timeout the mod who issued the command", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    mocks.getRecentMessages.mockReturnValue([
      { username: "mod", text: "bad phrase here", timestamp: Date.now() },
      { username: "spammer", text: "bad phrase", timestamp: Date.now() },
    ]);

    await nuke.execute({ say } as any, "#test", "mod", ["bad", "phrase"], mockMsg(true));

    // Only spammer should be timed out, not the mod
    const timeoutCalls = say.mock.calls.filter((c: any[]) => c[1]?.startsWith("/timeout"));
    expect(timeoutCalls).toHaveLength(1);
    expect(timeoutCalls[0][1]).toContain("spammer");
  });
});
