import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      botChannels: { findFirst: vi.fn() },
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
  users: {},
  botChannels: {},
  quotes: {},
}));
vi.mock("@/lib/setup", () => ({
  getBroadcasterUserId: mocks.getBroadcasterUserId,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: any) => props.children }));
vi.mock("next/image", () => ({ default: () => null }));

import QuotesPage, { generateMetadata } from "./page";

describe("QuotesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.users.findFirst.mockResolvedValue({ name: "TestStreamer" });

      const meta = await generateMetadata();
      expect(meta.title).toBe("Quotes — TestStreamer");
    });

    it("returns empty object when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);
      const meta = await generateMetadata();
      expect(meta).toEqual({});
    });
  });

  describe("page component", () => {
    it("renders quotes list", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.quotes.findMany.mockResolvedValue([
        { id: "q1", quoteNumber: 1, text: "Hello world", game: "Minecraft", addedBy: "viewer1" },
        { id: "q2", quoteNumber: 2, text: "GG", game: null, addedBy: "viewer2" },
      ]);

      const result = await QuotesPage();
      const html = JSON.stringify(result);
      expect(html).toContain("Hello world");
      expect(html).toContain("GG");
      expect(html).toContain("Minecraft");
      expect(html).toContain("viewer1");
    });

    it("renders empty state when no quotes", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.quotes.findMany.mockResolvedValue([]);

      const result = await QuotesPage();
      const html = JSON.stringify(result);
      expect(html).toContain("No quotes yet");
    });

    it("calls notFound when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);

      await QuotesPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });

    it("calls notFound when no bot channel", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);

      await QuotesPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
