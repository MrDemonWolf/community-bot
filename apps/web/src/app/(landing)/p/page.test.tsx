import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      }),
    }),
    query: {
      users: { findFirst: vi.fn() },
      twitchChannels: { findFirst: vi.fn() },
      botChannels: { findFirst: vi.fn() },
      twitchChatCommands: { findMany: vi.fn() },
      queueStates: { findFirst: vi.fn() },
      queueEntries: { findMany: vi.fn() },
      songRequestSettings: { findFirst: vi.fn() },
      songRequests: { findMany: vi.fn() },
      quotes: { findMany: vi.fn() },
    },
  },
  getBroadcasterUserId: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  eq: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  count: vi.fn(),
  users: {},
  twitchChannels: {},
  botChannels: {},
  twitchChatCommands: {},
  queueStates: {},
  queueEntries: {},
  songRequestSettings: {},
  songRequests: {},
  quotes: {},
}));
vi.mock("@/lib/setup", () => ({
  getBroadcasterUserId: mocks.getBroadcasterUserId,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: any) => props.children }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("./twitch-embed", () => ({ default: () => null }));

import PublicPage, { generateMetadata } from "./page";

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
  mocks.db.query.users.findFirst.mockResolvedValue(defaults.user);
  mocks.db.query.twitchChannels.findFirst.mockResolvedValue(defaults.twitchChannel);
  mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
  mocks.db.query.twitchChatCommands.findMany.mockResolvedValue(defaults.commands);
  mocks.db.query.queueStates.findFirst.mockResolvedValue(defaults.queueState);
  mocks.db.query.queueEntries.findMany.mockResolvedValue(defaults.queueEntries);
  mocks.db.query.songRequestSettings.findFirst.mockResolvedValue(
    defaults.songRequestSettings
  );
  mocks.db.query.songRequests.findMany.mockResolvedValue(defaults.songRequests);
  mocks.db.query.quotes.findMany.mockResolvedValue(defaults.quotes);
}

describe("PublicPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns profile title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.users.findFirst.mockResolvedValue({ name: "TestStreamer" });

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
      mocks.db.query.users.findFirst.mockResolvedValue(null);

      await PublicPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
