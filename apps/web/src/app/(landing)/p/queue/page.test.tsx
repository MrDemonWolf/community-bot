import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      queueStates: { findFirst: vi.fn() },
      queueEntries: { findMany: vi.fn() },
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
  queueStates: {},
  queueEntries: {},
}));
vi.mock("@/lib/setup", () => ({
  getBroadcasterUserId: mocks.getBroadcasterUserId,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: any) => props.children }));
vi.mock("next/image", () => ({ default: () => null }));

import QueuePage, { generateMetadata } from "./page";

describe("QueuePage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns queue title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.users.findFirst.mockResolvedValue({ name: "TestStreamer" });

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
      mocks.db.query.queueStates.findFirst.mockResolvedValue({ status: "OPEN" });
      mocks.db.query.queueEntries.findMany.mockResolvedValue([
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
      mocks.db.query.queueStates.findFirst.mockResolvedValue({ status: "OPEN" });
      mocks.db.query.queueEntries.findMany.mockResolvedValue([]);

      const result = await QueuePage();
      const html = JSON.stringify(result);
      expect(html).toContain("No one in the queue yet");
    });

    it("renders closed queue message", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.queueStates.findFirst.mockResolvedValue({ status: "CLOSED" });
      mocks.db.query.queueEntries.findMany.mockResolvedValue([]);

      const result = await QueuePage();
      const html = JSON.stringify(result);
      expect(html).toContain("The queue is currently closed");
    });

    it("calls notFound when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);

      await QueuePage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
