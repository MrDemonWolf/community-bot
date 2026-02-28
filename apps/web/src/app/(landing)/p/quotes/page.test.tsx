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

import QuotesPage, { generateMetadata } from "./page";

const p = mocks.prisma;

describe("QuotesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue({ name: "TestStreamer" });

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
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
      p.quote.findMany.mockResolvedValue([
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
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
      p.quote.findMany.mockResolvedValue([]);

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
      p.botChannel.findUnique.mockResolvedValue(null);

      await QuotesPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
