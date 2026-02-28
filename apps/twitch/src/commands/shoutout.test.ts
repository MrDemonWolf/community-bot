import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return {
    helixFetch: vi.fn(),
    generateShoutout: vi.fn(),
    isAiShoutoutGloballyEnabled: vi.fn(),
    prisma: new Proxy(mp, handler),
  };
});

vi.mock("../services/helixClient.js", () => ({
  helixFetch: mocks.helixFetch,
}));
vi.mock("../services/aiShoutout.js", () => ({
  generateShoutout: mocks.generateShoutout,
  isAiShoutoutGloballyEnabled: mocks.isAiShoutoutGloballyEnabled,
}));
vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));

import { shoutout } from "./shoutout.js";

const p = mocks.prisma;

function makeMockMsg(isMod = true) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("shoutout command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(false);
  });

  it("does nothing if user is not a mod", async () => {
    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage when no args", async () => {
    await shoutout.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@testuser, usage: !so <username>");
  });

  it("shouts out a user with game info", async () => {
    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "Fortnite",
          title: "Playing Fortnite",
        }],
      });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "Go check out Target at https://twitch.tv/target ! They were last playing Fortnite."
    );
  });

  it("shouts out without game when none set", async () => {
    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }],
      });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "Go check out Target at https://twitch.tv/target !"
    );
  });

  it("shows error when user not found", async () => {
    mocks.helixFetch.mockResolvedValueOnce({ data: [] });
    await shoutout.execute(client, "#channel", "testuser", ["nobody"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", '@testuser, could not find channel "nobody".');
  });

  it("strips @ from username", async () => {
    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }],
      });

    await shoutout.execute(client, "#channel", "testuser", ["@target"], makeMockMsg());
    expect(mocks.helixFetch).toHaveBeenCalledWith("users", { login: "target" });
  });

  it("sends AI shoutout when enabled for channel", async () => {
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(true);
    p.botChannel.findFirst.mockResolvedValue({ aiShoutoutEnabled: true });
    mocks.generateShoutout.mockResolvedValue("AI says: Target is awesome!");

    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "Fortnite",
          title: "",
        }],
      });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());

    // Should have standard shoutout + AI message
    expect(say).toHaveBeenCalledTimes(2);
    expect(say).toHaveBeenCalledWith("#channel", "AI says: Target is awesome!");
  });

  it("does not send AI shoutout when disabled for channel", async () => {
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(true);
    p.botChannel.findFirst.mockResolvedValue({ aiShoutoutEnabled: false });

    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }],
      });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());

    expect(say).toHaveBeenCalledTimes(1);
    expect(mocks.generateShoutout).not.toHaveBeenCalled();
  });

  it("still sends standard shoutout when AI fails", async () => {
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(true);
    p.botChannel.findFirst.mockResolvedValue({ aiShoutoutEnabled: true });
    mocks.generateShoutout.mockRejectedValue(new Error("API Error"));

    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }],
      });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());

    // Standard shoutout should still work
    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "Go check out Target at https://twitch.tv/target !"
    );
  });
});
