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

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));

import { permit } from "./permit.js";

const p = mocks.prisma;

function mockMsg(isMod: boolean, isBroadcaster = false) {
  return { userInfo: { isMod, isBroadcaster, userId: "u1" } } as any;
}

describe("permit command", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-mods", async () => {
    const say = vi.fn();
    await permit.execute({ say } as any, "#test", "user1", ["target"], mockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage when no args", async () => {
    const say = vi.fn();
    await permit.execute({ say } as any, "#test", "mod", [], mockMsg(true));
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("usage"));
  });

  it("creates a permit with default 60s duration", async () => {
    const say = vi.fn();
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.spamPermit.create.mockResolvedValue({});

    await permit.execute({ say } as any, "#test", "mod", ["targetuser"], mockMsg(true));

    expect(p.spamPermit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "targetuser",
          botChannelId: "bc-1",
        }),
      })
    );
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("60 seconds"));
  });

  it("creates a permit with custom duration", async () => {
    const say = vi.fn();
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.spamPermit.create.mockResolvedValue({});

    await permit.execute({ say } as any, "#test", "mod", ["targetuser", "120"], mockMsg(true));
    expect(say).toHaveBeenCalledWith("#test", expect.stringContaining("120 seconds"));
  });

  it("strips @ from username", async () => {
    const say = vi.fn();
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.spamPermit.create.mockResolvedValue({});

    await permit.execute({ say } as any, "#test", "mod", ["@targetuser"], mockMsg(true));
    expect(p.spamPermit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: "targetuser" }),
      })
    );
  });
});
