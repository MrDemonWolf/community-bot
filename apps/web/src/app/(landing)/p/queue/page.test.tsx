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

import QueuePage, { generateMetadata } from "./page";

const p = mocks.prisma;

describe("QueuePage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns queue title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue({ name: "TestStreamer" });

      const meta = await generateMetadata();
      expect(meta.title).toBe("Viewer Queue — TestStreamer");
    });

    it("returns empty object when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);
      const meta = await generateMetadata();
      expect(meta).toEqual({});
    });
  });

  describe("page component", () => {
    it("renders queue entries with positions", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.queueState.findFirst.mockResolvedValue({ status: "OPEN" });
      p.queueEntry.findMany.mockResolvedValue([
        { id: "e1", position: 1, twitchUsername: "player1" },
        { id: "e2", position: 2, twitchUsername: "player2" },
      ]);

      const result = await QueuePage();
      const html = JSON.stringify(result);
      expect(html).toContain("player1");
      expect(html).toContain("player2");
    });

    it("renders empty state with open queue", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.queueState.findFirst.mockResolvedValue({ status: "OPEN" });
      p.queueEntry.findMany.mockResolvedValue([]);

      const result = await QueuePage();
      const html = JSON.stringify(result);
      expect(html).toContain("No one in the queue yet");
    });

    it("renders closed queue message", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.queueState.findFirst.mockResolvedValue({ status: "CLOSED" });
      p.queueEntry.findMany.mockResolvedValue([]);

      const result = await QueuePage();
      const html = JSON.stringify(result);
      expect(html).toContain("The queue is currently closed");
    });

    it("calls notFound when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);
      p.queueState.findFirst.mockResolvedValue(null);
      p.queueEntry.findMany.mockResolvedValue([]);

      await QueuePage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
