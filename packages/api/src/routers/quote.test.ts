import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

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
  return { prisma: new Proxy(mp, handler), eventBus: { publish: vi.fn() }, logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { quoteRouter } from "./quote";

const createCaller = t.createCallerFactory(quoteRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("quoteRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns quotes for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findMany.mockResolvedValue([
        { id: "q1", quoteNumber: 1, text: "Hello" },
        { id: "q2", quoteNumber: 2, text: "World" },
      ]);
      const result = await caller.list();
      expect(result).toHaveLength(2);
      expect(p.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { botChannelId: "bc-1" } })
      );
    });

    it("throws when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("add", () => {
    it("creates a quote and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findFirst.mockResolvedValue({ quoteNumber: 5 });
      p.quote.create.mockResolvedValue({ id: "q6", quoteNumber: 6, text: "New quote" });

      const result = await caller.add({ text: "New quote" });
      expect(result.quoteNumber).toBe(6);
      expect(p.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quoteNumber: 6, text: "New quote", source: "web" }),
        })
      );
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("quote:created", { quoteId: "q6" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "quote.add" })
      );
    });

    it("starts at quote 1 when no quotes exist", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findFirst.mockResolvedValue(null);
      p.quote.create.mockResolvedValue({ id: "q1", quoteNumber: 1, text: "First" });

      const result = await caller.add({ text: "First" });
      expect(result.quoteNumber).toBe(1);
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.add({ text: "test" })).rejects.toThrow();
    });
  });

  describe("remove", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("removes a quote and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findUnique.mockResolvedValue({ id: UUID, quoteNumber: 3, botChannelId: "bc-1" });
      p.quote.delete.mockResolvedValue({});

      const result = await caller.remove({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("quote:deleted", { quoteId: UUID });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "quote.remove" })
      );
    });

    it("throws NOT_FOUND for missing quote", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findUnique.mockResolvedValue(null);
      await expect(caller.remove({ id: UUID })).rejects.toThrow("Quote not found");
    });

    it("throws NOT_FOUND for quote from different channel", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findUnique.mockResolvedValue({ id: UUID, botChannelId: "bc-other" });
      await expect(caller.remove({ id: UUID })).rejects.toThrow("Quote not found");
    });
  });

  describe("search", () => {
    it("returns matching quotes", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findMany.mockResolvedValue([
        { id: "q1", quoteNumber: 1, text: "Funny thing" },
      ]);
      const result = await caller.search({ query: "funny" });
      expect(result).toHaveLength(1);
    });
  });

  describe("get", () => {
    it("returns a specific quote by number", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findUnique.mockResolvedValue({ id: "q1", quoteNumber: 1, text: "Hello" });
      const result = await caller.get({ quoteNumber: 1 });
      expect(result.text).toBe("Hello");
    });

    it("throws NOT_FOUND for missing quote", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.quote.findUnique.mockResolvedValue(null);
      await expect(caller.get({ quoteNumber: 99 })).rejects.toThrow("Quote not found");
    });
  });
});
