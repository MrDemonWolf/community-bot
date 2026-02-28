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
import { spamFilterRouter } from "./spamFilter";

const createCaller = t.createCallerFactory(spamFilterRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("spamFilterRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("get", () => {
    it("returns existing filter config", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.spamFilter.findUnique.mockResolvedValue({
        capsEnabled: true,
        capsMinLength: 15,
        capsMaxPercent: 70,
        linksEnabled: false,
        linksAllowSubs: true,
        symbolsEnabled: false,
        symbolsMaxPercent: 50,
        emotesEnabled: false,
        emotesMaxCount: 15,
        repetitionEnabled: false,
        repetitionMaxRepeat: 10,
        bannedWordsEnabled: false,
        bannedWords: [],
        exemptLevel: "SUBSCRIBER",
        timeoutDuration: 5,
        warningMessage: "Don't spam.",
      });

      const result = await caller.get();
      expect(result.capsEnabled).toBe(true);
    });

    it("returns defaults when no filter exists", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.spamFilter.findUnique.mockResolvedValue(null);

      const result = await caller.get();
      expect(result.capsEnabled).toBe(false);
      expect(result.timeoutDuration).toBe(5);
    });
  });

  describe("update", () => {
    it("upserts filter config and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.spamFilter.upsert.mockResolvedValue({
        id: "sf-1",
        capsEnabled: true,
        linksEnabled: true,
      });

      const result = await caller.update({
        capsEnabled: true,
        linksEnabled: true,
      });

      expect(result.capsEnabled).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("spam-filter:updated", { channelId: "bc-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "spam-filter.update" })
      );
    });

    it("updates banned words", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.spamFilter.upsert.mockResolvedValue({
        id: "sf-1",
        bannedWordsEnabled: true,
        bannedWords: ["bad", "spam"],
      });

      const result = await caller.update({
        bannedWordsEnabled: true,
        bannedWords: ["bad", "spam"],
      });

      expect(result.bannedWords).toEqual(["bad", "spam"]);
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.update({ capsEnabled: true })).rejects.toThrow();
    });

    it("validates timeout duration range", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      await expect(caller.update({ timeoutDuration: 0 })).rejects.toThrow();
    });
  });
});
