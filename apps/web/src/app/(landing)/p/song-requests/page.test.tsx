import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      botChannels: { findFirst: vi.fn() },
      songRequestSettings: { findFirst: vi.fn() },
      songRequests: { findMany: vi.fn() },
    },
  },
  getBroadcasterUserId: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  eq: vi.fn(),
  asc: vi.fn(),
  users: {},
  botChannels: {},
  songRequestSettings: {},
  songRequests: {},
}));
vi.mock("@/lib/setup", () => ({
  getBroadcasterUserId: mocks.getBroadcasterUserId,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({
  default: (props: { children?: React.ReactNode }) => props.children,
}));
vi.mock("next/image", () => ({ default: () => null }));

import SongRequestsPage, { generateMetadata } from "./page";

describe("SongRequestsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.users.findFirst.mockResolvedValue({ name: "TestStreamer" });

      const meta = await generateMetadata();
      expect(meta.title).toBe("Song Requests — TestStreamer");
    });

    it("returns empty object when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);

      const meta = await generateMetadata();
      expect(meta).toEqual({});
    });
  });

  describe("page component", () => {
    it("renders song list when data exists", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({ enabled: true });
      mocks.db.query.songRequests.findMany.mockResolvedValue([
        { id: "sr-1", position: 1, title: "Song A", requestedBy: "viewer1" },
        { id: "sr-2", position: 2, title: "Song B", requestedBy: "viewer2" },
      ]);

      const result = await SongRequestsPage();
      const html = JSON.stringify(result);
      expect(html).toContain("Song A");
      expect(html).toContain("Song B");
      expect(html).toContain("viewer1");
    });

    it("renders empty state when no songs and enabled", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({ enabled: true });
      mocks.db.query.songRequests.findMany.mockResolvedValue([]);

      const result = await SongRequestsPage();
      const html = JSON.stringify(result);
      expect(html).toContain("No songs in the queue");
    });

    it("renders disabled state", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({ enabled: false });
      mocks.db.query.songRequests.findMany.mockResolvedValue([]);

      const result = await SongRequestsPage();
      const html = JSON.stringify(result);
      expect(html).toContain("Song requests are currently disabled");
    });

    it("calls notFound when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);

      await SongRequestsPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("calls notFound when no bot channel", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);

      await SongRequestsPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
