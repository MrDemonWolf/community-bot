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

import SongRequestsPage, { generateMetadata } from "./page";

const p = mocks.prisma;

describe("SongRequestsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue({ name: "TestStreamer" });

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
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({ enabled: true });
      p.songRequest.findMany.mockResolvedValue([
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
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({ enabled: true });
      p.songRequest.findMany.mockResolvedValue([]);

      const result = await SongRequestsPage();
      const html = JSON.stringify(result);
      expect(html).toContain("No songs in the queue");
    });

    it("renders disabled state", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
      p.songRequestSettings.findUnique.mockResolvedValue({ enabled: false });
      p.songRequest.findMany.mockResolvedValue([]);

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
      p.botChannel.findUnique.mockResolvedValue(null);

      await SongRequestsPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
