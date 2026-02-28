import { describe, it, expect, vi, beforeEach } from "vitest";

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
  return { prisma: new Proxy(mp, handler) };
});

vi.mock("@community-bot/db", () => ({
  prisma: mocks.prisma,
  Prisma: { PrismaClientKnownRequestError: class extends Error { code: string; constructor(msg: string, opts: any) { super(msg); this.code = opts.code; } } },
}));

import { counter } from "./counter.js";

const p = mocks.prisma;

function makeMockMsg(isMod = true) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("counter command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("does nothing for non-mod", async () => {
    await counter.execute(client, "#ch", "user", ["deaths"], makeMockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage with no args", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    await counter.execute(client, "#ch", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("usage"));
  });

  describe("with bot channel", () => {
    beforeEach(() => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    });

    it("creates a counter", async () => {
      p.twitchCounter.create.mockResolvedValue({ name: "deaths", value: 0 });
      await counter.execute(client, "#ch", "user", ["deaths", "create"], makeMockMsg());
      expect(p.twitchCounter.create).toHaveBeenCalledWith({
        data: { name: "deaths", botChannelId: "bc-1" },
      });
      expect(say).toHaveBeenCalledWith("#ch", '@user, counter "deaths" created (value: 0).');
    });

    it("deletes a counter", async () => {
      p.twitchCounter.delete.mockResolvedValue({});
      await counter.execute(client, "#ch", "user", ["deaths", "delete"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", '@user, counter "deaths" deleted.');
    });

    it("shows counter value", async () => {
      p.twitchCounter.findUnique.mockResolvedValue({ id: "c-1", value: 42 });
      await counter.execute(client, "#ch", "user", ["deaths"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", "deaths: 42");
    });

    it("increments counter with +", async () => {
      p.twitchCounter.findUnique.mockResolvedValue({ id: "c-1", value: 10 });
      p.twitchCounter.update.mockResolvedValue({ value: 11 });
      await counter.execute(client, "#ch", "user", ["deaths", "+"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", "deaths: 11");
    });

    it("decrements counter with -", async () => {
      p.twitchCounter.findUnique.mockResolvedValue({ id: "c-1", value: 10 });
      p.twitchCounter.update.mockResolvedValue({ value: 9 });
      await counter.execute(client, "#ch", "user", ["deaths", "-"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", "deaths: 9");
    });

    it("sets counter value", async () => {
      p.twitchCounter.findUnique.mockResolvedValue({ id: "c-1", value: 10 });
      p.twitchCounter.update.mockResolvedValue({ value: 50 });
      await counter.execute(client, "#ch", "user", ["deaths", "set", "50"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", "deaths: 50");
    });

    it("says counter not found if missing", async () => {
      p.twitchCounter.findUnique.mockResolvedValue(null);
      await counter.execute(client, "#ch", "user", ["missing"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("does not exist"));
    });
  });
});
