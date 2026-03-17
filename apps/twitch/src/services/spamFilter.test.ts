import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      botChannels: { findFirst: vi.fn() },
      spamFilters: { findFirst: vi.fn() },
      spamPermits: { findFirst: vi.fn() },
    },
  },
  getUserAccessLevel: vi.fn(),
  meetsAccessLevel: vi.fn(),
}));

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  eq: vi.fn(), and: vi.fn(), or: vi.fn(), not: vi.fn(),
  gt: vi.fn(), gte: vi.fn(), lt: vi.fn(), lte: vi.fn(), ne: vi.fn(),
  like: vi.fn(), ilike: vi.fn(), inArray: vi.fn(), notInArray: vi.fn(),
  isNull: vi.fn(), isNotNull: vi.fn(),
  asc: vi.fn(), desc: vi.fn(), count: vi.fn(), sql: vi.fn(),
  between: vi.fn(), exists: vi.fn(), notExists: vi.fn(),
  // Table schemas (empty objects)
  users: {}, accounts: {}, sessions: {}, botChannels: {},
  twitchChatCommands: {}, twitchRegulars: {}, twitchCounters: {},
  twitchTimers: {}, twitchChannels: {}, twitchNotifications: {},
  twitchCredentials: {}, quotes: {}, songRequests: {},
  songRequestSettings: {}, bannedTracks: {}, playlists: {},
  playlistEntries: {}, giveaways: {}, giveawayEntries: {},
  polls: {}, pollOptions: {}, pollVotes: {},
  queueEntries: {}, queueStates: {},
  discordGuilds: {}, auditLogs: {}, systemConfigs: {},
  defaultCommandOverrides: {}, spamFilters: {}, spamPermits: {},
  regulars: {},
  // Enums
  QueueStatus: { OPEN: "OPEN", CLOSED: "CLOSED", PAUSED: "PAUSED" },
  TwitchAccessLevel: {
    EVERYONE: "EVERYONE", SUBSCRIBER: "SUBSCRIBER", REGULAR: "REGULAR",
    VIP: "VIP", MODERATOR: "MODERATOR", LEAD_MODERATOR: "LEAD_MODERATOR",
    BROADCASTER: "BROADCASTER",
  },
}));
vi.mock("./accessControl.js", () => ({
  getUserAccessLevel: mocks.getUserAccessLevel,
  meetsAccessLevel: mocks.meetsAccessLevel }));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));

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

describe("spamFilter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("checkCaps", () => {
    it("returns true when message exceeds caps threshold", () => {
      expect(checkCaps("THIS IS ALL CAPS MESSAGE", 10, 70)).toBe(true);
    });

    it("returns false for short messages below min length", () => {
      expect(checkCaps("HI", 10, 70)).toBe(false);
    });

    it("returns false when caps percentage is below threshold", () => {
      expect(checkCaps("Hello World This Is Mixed", 10, 70)).toBe(false);
    });
  });

  describe("checkLinks", () => {
    it("returns true for messages with URLs", () => {
      expect(checkLinks("visit https://example.com")).toBe(true);
    });

    it("returns false for clean messages", () => {
      expect(checkLinks("hello world")).toBe(false);
    });
  });

  describe("checkSymbols", () => {
    it("returns true for excessive symbols", () => {
      expect(checkSymbols("!!!!!!!!!!", 50)).toBe(true);
    });

    it("returns false for normal messages", () => {
      expect(checkSymbols("Hello world!", 50)).toBe(false);
    });
  });

  describe("checkRepetition", () => {
    it("returns true for repeated characters", () => {
      expect(checkRepetition("aaaaaaaaaaaaaaaa", 5)).toBe(true);
    });

    it("returns false for normal text", () => {
      expect(checkRepetition("hello", 5)).toBe(false);
    });
  });

  describe("checkBannedWords", () => {
    it("returns true when banned word found", () => {
      expect(checkBannedWords("this has badword in it", ["badword"])).toBeTruthy();
    });

    it("returns false when no banned words", () => {
      expect(checkBannedWords("clean message", ["badword"])).toBeFalsy();
    });
  });

  describe("checkEmotes", () => {
    it("returns true for excessive emotes", () => {
      expect(checkEmotes("Kappa Kappa Kappa Kappa Kappa", 3)).toBe(true);
    });
  });

  describe("loadSpamFilter", () => {
    it("loads filter config from database", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.spamFilters.findFirst.mockResolvedValue({
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
        warningMessage: "Don't spam." });

      await loadSpamFilter("testchannel");
      const config = getFilterConfig("testchannel");
      expect(config).toBeDefined();
      expect(config!.capsEnabled).toBe(true);
    });

    it("clears config when no filter exists", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.spamFilters.findFirst.mockResolvedValue(null);

      await loadSpamFilter("testchannel");
      expect(getFilterConfig("testchannel")).toBeUndefined();
    });

    it("does nothing when no bot channel found", async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await loadSpamFilter("testchannel");
    });
  });

  describe("checkMessage", () => {
    const mockMsg = {
      userInfo: {
        isMod: false,
        isBroadcaster: false,
        isMod: false,
        isVip: false,
        isSubscriber: false,
        isFounder: false,
        userId: "user-1",
      },
    } as any;

    beforeEach(async () => {
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
      mocks.db.query.spamFilters.findFirst.mockResolvedValue({
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
        warningMessage: "Don't spam." });
      await loadSpamFilter("testchannel");

      mocks.getUserAccessLevel.mockReturnValue("EVERYONE");
      mocks.meetsAccessLevel.mockReturnValue(false);
      mocks.db.query.spamPermits.findFirst.mockResolvedValue(null);
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
      mocks.db.query.spamPermits.findFirst.mockResolvedValue({ id: "permit-1" });
      const result = await checkMessage("#testchannel", "user1", "badword", mockMsg);
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
