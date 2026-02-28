import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getBroadcasterId: vi.fn(),
  prisma: {
    twitchCredential: { findFirst: vi.fn() },
  },
}));

vi.mock("../services/broadcasterCache.js", () => ({
  getBroadcasterId: mocks.getBroadcasterId,
}));
vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../utils/env.js", () => ({
  env: { TWITCH_APPLICATION_CLIENT_ID: "test-client-id" },
}));

import { clip } from "./clip.js";

describe("clip command", () => {
  const msg = { userInfo: { isMod: false, isBroadcaster: false, userId: "u1" } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("says error when broadcaster ID not found", async () => {
    mocks.getBroadcasterId.mockReturnValue(null);
    const say = vi.fn();

    await clip.execute({ say } as any, "#test", "user1", [], msg);
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("could not determine"));
  });

  it("creates a clip and returns the URL", async () => {
    mocks.getBroadcasterId.mockReturnValue("123");
    mocks.prisma.twitchCredential.findFirst.mockResolvedValue({ accessToken: "token123" });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "ClipABC123", edit_url: "" }] }),
    });

    const say = vi.fn();
    await clip.execute({ say } as any, "#test", "user1", [], msg);

    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("https://clips.twitch.tv/ClipABC123"));
  });

  it("handles API failure gracefully", async () => {
    mocks.getBroadcasterId.mockReturnValue("123");
    mocks.prisma.twitchCredential.findFirst.mockResolvedValue({ accessToken: "token123" });
    (globalThis.fetch as any).mockResolvedValue({ ok: false, status: 403 });

    const say = vi.fn();
    await clip.execute({ say } as any, "#test", "user1", [], msg);

    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("failed to create clip"));
  });
});
