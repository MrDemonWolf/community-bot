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
    prisma: new Proxy(mp, handler),
    helixFetch: vi.fn(),
    helixPost: vi.fn(),
    helixPatch: vi.fn(),
    getBroadcasterId: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({
  prisma: mocks.prisma,
  TwitchAccessLevel: { BROADCASTER: "BROADCASTER", MODERATOR: "MODERATOR", VIP: "VIP", REGULAR: "REGULAR", SUBSCRIBER: "SUBSCRIBER", EVERYONE: "EVERYONE" },
}));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../services/helixClient.js", () => ({
  helixFetch: mocks.helixFetch,
  helixPost: mocks.helixPost,
  helixPatch: mocks.helixPatch,
}));
vi.mock("../services/broadcasterCache.js", () => ({
  getBroadcasterId: mocks.getBroadcasterId,
}));

import { poll } from "./poll.js";

function makeMockMsg(isMod = true) {
  return {
    userInfo: {
      userId: "user-123",
      userName: "testuser",
      isBroadcaster: false,
      isMod,
      isSubscriber: false,
      isVip: false,
      badges: new Map(isMod ? [["moderator", "1"]] : []),
    },
  } as any;
}

describe("poll command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBroadcasterId.mockReturnValue("broadcaster-456");
  });

  it("rejects non-mods", async () => {
    await poll.execute(client, "#channel", "viewer", ["create"], makeMockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  describe("create", () => {
    it("creates a poll with quoted args", async () => {
      mocks.helixPost.mockResolvedValue({ data: [{ id: "poll-1" }] });

      await poll.execute(
        client,
        "#channel",
        "moduser",
        ["create", '"Best', 'game?"', '"Minecraft"', '"Fortnite"', "120"],
        makeMockMsg()
      );

      expect(mocks.helixPost).toHaveBeenCalledWith("polls", {
        broadcaster_id: "broadcaster-456",
        title: "Best game?",
        choices: [{ title: "Minecraft" }, { title: "Fortnite" }],
        duration: 120,
      });
      expect(say).toHaveBeenCalledWith("#channel", "Poll started: Best game?");
    });

    it("shows usage with insufficient quoted args", async () => {
      await poll.execute(
        client,
        "#channel",
        "moduser",
        ["create", '"Question"', '"OnlyOneOption"'],
        makeMockMsg()
      );

      expect(mocks.helixPost).not.toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith(
        "#channel",
        expect.stringContaining("Usage: !poll create")
      );
    });

    it("uses default duration of 60 when none specified", async () => {
      mocks.helixPost.mockResolvedValue({ data: [{ id: "poll-1" }] });

      await poll.execute(
        client,
        "#channel",
        "moduser",
        ["create", '"Question"', '"A"', '"B"'],
        makeMockMsg()
      );

      expect(mocks.helixPost).toHaveBeenCalledWith(
        "polls",
        expect.objectContaining({ duration: 60 })
      );
    });
  });

  describe("end", () => {
    it("ends an active poll", async () => {
      mocks.helixFetch.mockResolvedValue({
        data: [{ id: "poll-1", status: "ACTIVE" }],
      });
      mocks.helixPatch.mockResolvedValue({ data: [{ id: "poll-1" }] });

      await poll.execute(client, "#channel", "moduser", ["end"], makeMockMsg());

      expect(mocks.helixPatch).toHaveBeenCalledWith("polls", {
        broadcaster_id: "broadcaster-456",
        id: "poll-1",
        status: "TERMINATED",
      });
      expect(say).toHaveBeenCalledWith("#channel", "Poll ended.");
    });

    it("shows message when no active poll found", async () => {
      mocks.helixFetch.mockResolvedValue({
        data: [{ id: "poll-1", status: "COMPLETED" }],
      });

      await poll.execute(client, "#channel", "moduser", ["end"], makeMockMsg());

      expect(mocks.helixPatch).not.toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith(
        "#channel",
        "@moduser, No active poll found."
      );
    });
  });

  describe("results", () => {
    it("displays poll results", async () => {
      mocks.helixFetch.mockResolvedValue({
        data: [
          {
            id: "poll-1",
            title: "Best game?",
            status: "COMPLETED",
            choices: [
              { title: "Minecraft", votes: 10 },
              { title: "Fortnite", votes: 5 },
            ],
          },
        ],
      });

      await poll.execute(client, "#channel", "moduser", ["results"], makeMockMsg());

      expect(say).toHaveBeenCalledWith(
        "#channel",
        "[COMPLETED] Best game? — Minecraft: 10 | Fortnite: 5"
      );
    });

    it("shows no polls message when none found", async () => {
      mocks.helixFetch.mockResolvedValue({ data: [] });

      await poll.execute(client, "#channel", "moduser", ["results"], makeMockMsg());

      expect(say).toHaveBeenCalledWith("#channel", "@moduser, No polls found.");
    });
  });

  it("shows usage for unknown subcommand", async () => {
    await poll.execute(client, "#channel", "moduser", ["unknown"], makeMockMsg());
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "@moduser, Usage: !poll create|end|results"
    );
  });
});
