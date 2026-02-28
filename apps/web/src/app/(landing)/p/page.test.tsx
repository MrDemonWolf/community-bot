import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) {
            if (!m[method]) m[method] = vi.fn();
            return m[method];
          },
        });
      }
      return target[prop];
    },
  };
  return {
    prisma: new Proxy(mp, handler),
    getBroadcasterUserId: vi.fn(),
    notFound: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ default: mocks.prisma }));
vi.mock("@/lib/setup", () => ({
  getBroadcasterUserId: mocks.getBroadcasterUserId,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: any) => props.children }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("./twitch-embed", () => ({ default: () => null }));

import PublicPage, { generateMetadata } from "./page";

const p = mocks.prisma;

function setupProfileMocks(overrides: Record<string, any> = {}) {
  const defaults = {
    user: {
      id: "user-1",
      name: "TestStreamer",
      image: "https://example.com/avatar.png",
      accounts: [{ providerId: "twitch", accountId: "123" }],
    },
    twitchChannel: {
      username: "teststreamer",
      isLive: true,
      lastStreamTitle: "Playing games!",
      lastGameName: "Minecraft",
      lastStartedAt: new Date(),
    },
    commands: [{ name: "hello" }, { name: "world" }],
    queueState: { status: "OPEN" },
    queueEntries: [{ twitchUsername: "player1", position: 1 }],
    songRequestSettings: { enabled: true },
    songRequests: [
      { id: "sr-1", position: 1, title: "Song A", requestedBy: "viewer1" },
    ],
    quotes: [
      { id: "q1", quoteNumber: 1, text: "Famous quote" },
    ],
    ...overrides,
  };

  mocks.getBroadcasterUserId.mockResolvedValue("user-1");
  p.user.findUnique.mockResolvedValue(defaults.user);
  p.twitchChannel.findFirst.mockResolvedValue(defaults.twitchChannel);
  p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
  p.twitchChatCommand.findMany.mockResolvedValue(defaults.commands);
  p.queueState.findFirst.mockResolvedValue(defaults.queueState);
  p.queueEntry.findMany.mockResolvedValue(defaults.queueEntries);
  p.songRequestSettings.findUnique.mockResolvedValue(
    defaults.songRequestSettings
  );
  p.songRequest.findMany.mockResolvedValue(defaults.songRequests);
  p.quote.findMany.mockResolvedValue(defaults.quotes);
}

describe("PublicPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns profile title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue({ name: "TestStreamer" });

      const meta = await generateMetadata();
      expect(meta.title).toBe("TestStreamer's Community");
    });

    it("returns empty object when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);
      const meta = await generateMetadata();
      expect(meta).toEqual({});
    });
  });

  describe("page component", () => {
    it("renders profile with stream status, commands, queue, and song requests", async () => {
      setupProfileMocks();

      const result = await PublicPage();
      const html = JSON.stringify(result);
      expect(html).toContain("TestStreamer");
      expect(html).toContain("Live");
      expect(html).toContain("hello");
      expect(html).toContain("player1");
      expect(html).toContain("Song A");
      expect(html).toContain("Famous quote");
    });

    it("renders minimal profile when offline with no extras", async () => {
      setupProfileMocks({
        twitchChannel: {
          username: "teststreamer",
          isLive: false,
          lastStreamTitle: null,
          lastGameName: null,
          lastStartedAt: null,
        },
        commands: [],
        queueState: { status: "CLOSED" },
        queueEntries: [],
        songRequestSettings: { enabled: false },
        songRequests: [],
        quotes: [],
      });

      const result = await PublicPage();
      const html = JSON.stringify(result);
      expect(html).toContain("Offline");
      expect(html).not.toContain("Chat Commands");
      expect(html).not.toContain("Song A");
    });

    it("calls notFound when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);

      await PublicPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("calls notFound when user not found", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue(null);

      await PublicPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
