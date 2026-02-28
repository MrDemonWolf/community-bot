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
  return {
    prisma: new Proxy(mp, handler),
    getUserAccessLevel: vi.fn(),
    meetsAccessLevel: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma, TwitchAccessLevel: { EVERYONE: "EVERYONE", SUBSCRIBER: "SUBSCRIBER", REGULAR: "REGULAR", VIP: "VIP", MODERATOR: "MODERATOR", LEAD_MODERATOR: "LEAD_MODERATOR", BROADCASTER: "BROADCASTER" } }));
vi.mock("./accessControl.js", () => ({
  getUserAccessLevel: mocks.getUserAccessLevel,
  meetsAccessLevel: mocks.meetsAccessLevel,
}));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import {
  checkCaps,
  checkLinks,
  checkSymbols,
  checkRepetition,
  checkBannedWords,
  checkEmotes,
  loadSpamFilter,
  checkMessage,
  getFilterConfig,
} from "./spamFilter.js";

const p = mocks.prisma;

describe("spamFilter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("checkCaps", () => {
    it("returns true when message exceeds caps threshold", () => {
      expect(checkCaps("THIS IS ALL CAPS MESSAGE", 10, 70)).toBe(true);
    });

    it("returns false for short messages below min length", () => {
      expect(checkCaps("HELLO", 10, 70)).toBe(false);
    });

    it("returns false when within threshold", () => {
      expect(checkCaps("mostly lowercase with SOME caps", 10, 70)).toBe(false);
    });
  });

  describe("checkLinks", () => {
    it("detects http URLs", () => {
      expect(checkLinks("check out https://example.com")).toBe(true);
    });

    it("detects domain-style links", () => {
      expect(checkLinks("visit example.com please")).toBe(true);
    });

    it("returns false for normal text", () => {
      expect(checkLinks("hello world how are you")).toBe(false);
    });
  });

  describe("checkSymbols", () => {
    it("detects excessive symbols", () => {
      expect(checkSymbols("!!!@@@###$$$%%%", 50)).toBe(true);
    });

    it("allows normal punctuation", () => {
      expect(checkSymbols("Hello, how are you?", 50)).toBe(false);
    });
  });

  describe("checkEmotes", () => {
    it("detects excessive word count as emote proxy", () => {
      const manyWords = Array(20).fill("Kappa").join(" ");
      expect(checkEmotes(manyWords, 15)).toBe(true);
    });

    it("allows normal message length", () => {
      expect(checkEmotes("Hello there friend", 15)).toBe(false);
    });
  });

  describe("checkRepetition", () => {
    it("detects repeated characters", () => {
      expect(checkRepetition("aaaaaaaaaa hello", 10)).toBe(true);
    });

    it("detects repeated words", () => {
      expect(checkRepetition("spam spam spam spam spam spam spam spam spam spam", 10)).toBe(true);
    });

    it("allows normal text", () => {
      expect(checkRepetition("this is a normal message", 10)).toBe(false);
    });
  });

  describe("checkBannedWords", () => {
    it("detects banned word in text", () => {
      expect(checkBannedWords("this has badword in it", ["badword"])).toBe("badword");
    });

    it("is case insensitive", () => {
      expect(checkBannedWords("this has BADWORD in it", ["badword"])).toBe("badword");
    });

    it("returns null for clean text", () => {
      expect(checkBannedWords("this is clean", ["badword"])).toBeNull();
    });
  });

  describe("loadSpamFilter", () => {
    it("loads filter config from database", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
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

      await loadSpamFilter("testchannel");
      const config = getFilterConfig("testchannel");
      expect(config).toBeDefined();
      expect(config!.capsEnabled).toBe(true);
    });

    it("clears config when no filter exists", async () => {
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.spamFilter.findUnique.mockResolvedValue(null);

      await loadSpamFilter("testchannel");
      expect(getFilterConfig("testchannel")).toBeUndefined();
    });

    it("does nothing when no bot channel found", async () => {
      p.botChannel.findFirst.mockResolvedValue(null);
      await loadSpamFilter("unknown");
      expect(getFilterConfig("unknown")).toBeUndefined();
    });
  });

  describe("checkMessage", () => {
    const mockMsg = {
      userInfo: {
        isBroadcaster: false,
        isMod: false,
        isVip: false,
        isSubscriber: false,
        isFounder: false,
        userId: "user-1",
      },
    } as any;

    beforeEach(async () => {
      // Load a filter config first
      p.botChannel.findFirst.mockResolvedValue({ id: "bc-1" });
      p.spamFilter.findUnique.mockResolvedValue({
        capsEnabled: true,
        capsMinLength: 10,
        capsMaxPercent: 70,
        linksEnabled: true,
        linksAllowSubs: true,
        symbolsEnabled: false,
        symbolsMaxPercent: 50,
        emotesEnabled: false,
        emotesMaxCount: 15,
        repetitionEnabled: false,
        repetitionMaxRepeat: 10,
        bannedWordsEnabled: true,
        bannedWords: ["badword"],
        exemptLevel: "SUBSCRIBER",
        timeoutDuration: 5,
        warningMessage: "Don't spam.",
      });
      await loadSpamFilter("testchannel");

      mocks.getUserAccessLevel.mockReturnValue("EVERYONE");
      mocks.meetsAccessLevel.mockReturnValue(false);
      // No active permit
      p.spamPermit.findFirst.mockResolvedValue(null);
    });

    it("returns null for mods", async () => {
      mocks.getUserAccessLevel.mockReturnValue("MODERATOR");
      const result = await checkMessage("#testchannel", "moduser", "HELLO CAPS", mockMsg);
      expect(result).toBeNull();
    });

    it("returns null for broadcasters", async () => {
      mocks.getUserAccessLevel.mockReturnValue("BROADCASTER");
      const result = await checkMessage("#testchannel", "broadcaster", "badword", mockMsg);
      expect(result).toBeNull();
    });

    it("returns null for exempt level users", async () => {
      mocks.getUserAccessLevel.mockReturnValue("SUBSCRIBER");
      mocks.meetsAccessLevel.mockReturnValue(true);
      const result = await checkMessage("#testchannel", "subuser", "badword here", mockMsg);
      expect(result).toBeNull();
    });

    it("returns null for users with active permit", async () => {
      p.spamPermit.findFirst.mockResolvedValue({ id: "p1", expiresAt: new Date(Date.now() + 60000) });
      const result = await checkMessage("#testchannel", "permitted", "https://example.com", mockMsg);
      expect(result).toBeNull();
    });

    it("detects banned words", async () => {
      const result = await checkMessage("#testchannel", "user1", "this has badword in it", mockMsg);
      expect(result).toBe("banned_words");
    });

    it("detects links", async () => {
      const result = await checkMessage("#testchannel", "user1", "visit https://spam.com now", mockMsg);
      expect(result).toBe("links");
    });

    it("detects caps", async () => {
      const result = await checkMessage("#testchannel", "user1", "THIS IS ALL CAPS MESSAGE HERE", mockMsg);
      expect(result).toBe("caps");
    });

    it("returns null for clean messages", async () => {
      const result = await checkMessage("#testchannel", "user1", "hello world", mockMsg);
      expect(result).toBeNull();
    });
  });
});
