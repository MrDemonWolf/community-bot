import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  return {
    prisma: new Proxy(mp, handler),
    isLive: vi.fn(),
    getMessageCount: vi.fn(),
    resetMessageCount: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("./streamStatusManager.js", () => ({
  isLive: mocks.isLive,
}));
vi.mock("./chatterTracker.js", () => ({
  getMessageCount: mocks.getMessageCount,
  resetMessageCount: mocks.resetMessageCount,
}));
vi.mock("./commandExecutor.js", () => ({
  substituteVariables: vi.fn(async (msg: string) => msg),
}));
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  loadTimers,
  stopTimers,
  stopAll,
  getActiveTimerCount,
  setChatClient,
} from "./timerManager.js";

const p = mocks.prisma;

describe("timerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stopAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    stopAll();
  });

  it("loads enabled timers for a channel", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Follow me!", intervalMinutes: 5, chatLines: 0, enabled: true },
      { id: "t2", name: "social", message: "Join Discord!", intervalMinutes: 10, chatLines: 0, enabled: true },
    ]);

    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(2);
  });

  it("stops timers for a channel", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Follow me!", intervalMinutes: 5, chatLines: 0, enabled: true },
    ]);

    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(1);

    stopTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(0);
  });

  it("does nothing when no bot channel found", async () => {
    p.botChannel.findFirst.mockResolvedValue(null);
    await loadTimers("unknown");
    expect(getActiveTimerCount("unknown")).toBe(0);
  });

  it("does nothing when no timers configured", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([]);
    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(0);
  });

  it("reloads timers (stops old, loads new)", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Follow!", intervalMinutes: 5, chatLines: 0, enabled: true },
    ]);

    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(1);

    // Reload with different timers
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t2", name: "social", message: "Discord!", intervalMinutes: 10, chatLines: 0, enabled: true },
      { id: "t3", name: "youtube", message: "Subscribe!", intervalMinutes: 15, chatLines: 0, enabled: true },
    ]);

    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(2);
  });

  it("fires timer when channel is live and chat lines met", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    setChatClient({ say } as any);

    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Follow me!", intervalMinutes: 1, chatLines: 5, enabled: true },
    ]);

    mocks.isLive.mockReturnValue(true);
    mocks.getMessageCount.mockReturnValue(10);

    await loadTimers("testchannel");

    // Advance past the interval and flush all microtasks
    await vi.advanceTimersByTimeAsync(60_000);
    // Allow dynamic import and async operations to settle
    await vi.advanceTimersByTimeAsync(0);

    expect(say).toHaveBeenCalledWith("#testchannel", "Follow me!");
    expect(mocks.resetMessageCount).toHaveBeenCalledWith("testchannel");
  });

  it("does not fire when channel is offline", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    setChatClient({ say } as any);

    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Follow me!", intervalMinutes: 1, chatLines: 0, enabled: true },
    ]);

    mocks.isLive.mockReturnValue(false);

    await loadTimers("testchannel");
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(say).not.toHaveBeenCalled();
  });

  it("does not fire when chat lines threshold not met", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    setChatClient({ say } as any);

    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Follow me!", intervalMinutes: 1, chatLines: 50, enabled: true },
    ]);

    mocks.isLive.mockReturnValue(true);
    mocks.getMessageCount.mockReturnValue(10); // only 10, need 50

    await loadTimers("testchannel");
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(say).not.toHaveBeenCalled();
  });

  it("normalizes channel names with # prefix", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Hi!", intervalMinutes: 5, chatLines: 0, enabled: true },
    ]);

    await loadTimers("#TestChannel");
    expect(getActiveTimerCount("testchannel")).toBe(1);
  });

  it("stopAll clears all channels", async () => {
    p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
    p.twitchTimer.findMany.mockResolvedValue([
      { id: "t1", name: "promo", message: "Hi!", intervalMinutes: 5, chatLines: 0, enabled: true },
    ]);

    await loadTimers("channel1");

    p.botChannel.findFirst.mockResolvedValue({ id: "bc-2" });
    await loadTimers("channel2");

    expect(getActiveTimerCount("channel1")).toBe(1);
    expect(getActiveTimerCount("channel2")).toBe(1);

    stopAll();

    expect(getActiveTimerCount("channel1")).toBe(0);
    expect(getActiveTimerCount("channel2")).toBe(0);
  });
});
