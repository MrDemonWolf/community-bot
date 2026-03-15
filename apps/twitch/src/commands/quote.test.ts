import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; } });
      }
      return target[prop];
    },
  };
  return {
    db: new Proxy(mp, handler),
    getGame: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ db: mocks.db }));
vi.mock("../services/streamStatusManager.js", () => ({
  getGame: mocks.getGame }));

import { quote } from "./quote.js";

const p = mocks.db;

function makeMockMsg(isMod = false) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("quote command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("says no bot channel when not configured", async () => {
    p.query.botChannels.findFirst.mockResolvedValue(null);
    await quote.execute(client, "#channel", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@user, bot channel not configured.");
  });

  describe("with bot channel", () => {
    beforeEach(() => {
      p.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    });

    it("shows random quote", async () => {
      p.query.quotes.count.mockResolvedValue(3);
      p.query.quotes.findMany.mockResolvedValue([
        { quoteNumber: 2, text: "Funny quote", game: "Minecraft" },
      ]);
      await quote.execute(client, "#channel", "user", [], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", '#2: "Funny quote" [Minecraft]');
    });

    it("shows no quotes message when empty", async () => {
      p.query.quotes.count.mockResolvedValue(0);
      await quote.execute(client, "#channel", "user", [], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", "@user, no quotes yet. Add one with !quote add <text>");
    });

    it("shows specific quote by number", async () => {
      p.query.quotes.findFirst.mockResolvedValue({ quoteNumber: 5, text: "Hello", game: null });
      await quote.execute(client, "#channel", "user", ["5"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", '#5: "Hello"');
    });

    it("shows not found for missing quote number", async () => {
      p.query.quotes.findFirst.mockResolvedValue(null);
      await quote.execute(client, "#channel", "user", ["99"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#channel", "@user, quote #99 not found.");
    });

    it("adds a quote as mod", async () => {
      p.query.quotes.findFirst.mockResolvedValue({ quoteNumber: 3 });
      mocks.getGame.mockReturnValue("Valorant");
      p.query.quotes.create.mockResolvedValue({ quoteNumber: 4 });
      await quote.execute(client, "#channel", "moduser", ["add", "Something", "funny"], makeMockMsg(true));
      expect(p.query.quotes.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          quoteNumber: 4,
          text: "Something funny",
          game: "Valorant",
          addedBy: "moduser",
          source: "twitch",
          botChannelId: "bc-1" }) }));
      expect(say).toHaveBeenCalledWith("#channel", "@moduser, quote #4 added.");
    });

    it("rejects add from non-mod", async () => {
      await quote.execute(client, "#channel", "user", ["add", "test"], makeMockMsg(false));
      expect(say).toHaveBeenCalledWith("#channel", "@user, only moderators can add quotes.");
    });

    it("removes a quote as mod", async () => {
      p.query.quotes.delete.mockResolvedValue({});
      await quote.execute(client, "#channel", "moduser", ["remove", "3"], makeMockMsg(true));
      expect(p.query.quotes.delete).toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith("#channel", "@moduser, quote #3 removed.");
    });

    it("shows usage for add without text", async () => {
      await quote.execute(client, "#channel", "moduser", ["add"], makeMockMsg(true));
      expect(say).toHaveBeenCalledWith("#channel", "@moduser, usage: !quote add <text>");
    });
  });
});
