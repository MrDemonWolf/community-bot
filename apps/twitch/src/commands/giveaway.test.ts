import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  startGiveaway: vi.fn(),
  drawWinner: vi.fn(),
  endGiveaway: vi.fn(),
  getEntryCount: vi.fn(),
  getActiveGiveaway: vi.fn(),
  getBotChannelId: vi.fn(),
}));

vi.mock("@community-bot/db", () => ({
  prisma: {},
  TwitchAccessLevel: { BROADCASTER: "BROADCASTER", MODERATOR: "MODERATOR", VIP: "VIP", REGULAR: "REGULAR", SUBSCRIBER: "SUBSCRIBER", EVERYONE: "EVERYONE" },
}));
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../services/giveawayManager.js", () => ({
  startGiveaway: mocks.startGiveaway,
  drawWinner: mocks.drawWinner,
  endGiveaway: mocks.endGiveaway,
  getEntryCount: mocks.getEntryCount,
  getActiveGiveaway: mocks.getActiveGiveaway,
}));
vi.mock("../services/broadcasterCache.js", () => ({
  getBotChannelId: mocks.getBotChannelId,
}));
vi.mock("@community-bot/events", () => ({
  EventBus: vi.fn(),
}));

import { giveaway } from "./giveaway.js";

function makeMockMsg(isMod = true) {
  return {
    userInfo: {
      userId: "user-123",
      userName: "testuser",
      isBroadcaster: false,
      isMod,
      isSubscriber: false,
      isVip: false,
      badges: new Map(isMod ? [["moderator", "1"]] : []),
    },
  } as any;
}

describe("giveaway command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBotChannelId.mockReturnValue("bc-1");
  });

  describe("start", () => {
    it("starts a giveaway with keyword and title", async () => {
      mocks.startGiveaway.mockResolvedValue({ id: "ga-1", keyword: "!enter", title: "Win a prize" });

      await giveaway.execute(client, "#channel", "moduser", ["start", "!enter", "Win", "a", "prize"], makeMockMsg());

      expect(mocks.startGiveaway).toHaveBeenCalledWith("bc-1", "!enter", "Win a prize");
      expect(say).toHaveBeenCalledWith(
        "#channel",
        expect.stringContaining("Giveaway started!")
      );
    });

    it("uses default title when none provided", async () => {
      mocks.startGiveaway.mockResolvedValue({ id: "ga-1", keyword: "enter", title: "Giveaway (enter)" });

      await giveaway.execute(client, "#channel", "moduser", ["start", "enter"], makeMockMsg());

      expect(mocks.startGiveaway).toHaveBeenCalledWith("bc-1", "enter", "Giveaway (enter)");
    });

    it("shows usage when no keyword provided", async () => {
      await giveaway.execute(client, "#channel", "moduser", ["start"], makeMockMsg());

      expect(mocks.startGiveaway).not.toHaveBeenCalled();
      expect(say).toHaveBeenCalledWith(
        "#channel",
        expect.stringContaining("Usage: !giveaway start")
      );
    });

    it("rejects non-mods", async () => {
      await giveaway.execute(client, "#channel", "viewer", ["start", "enter"], makeMockMsg(false));
      expect(mocks.startGiveaway).not.toHaveBeenCalled();
      expect(say).not.toHaveBeenCalled();
    });
  });

  describe("draw", () => {
    it("draws a winner and announces", async () => {
      mocks.drawWinner.mockResolvedValue("winnerguy");
      mocks.getActiveGiveaway.mockResolvedValue({ id: "ga-1" });

      await giveaway.execute(client, "#channel", "moduser", ["draw"], makeMockMsg());

      expect(mocks.drawWinner).toHaveBeenCalledWith("bc-1");
      expect(say).toHaveBeenCalledWith(
        "#channel",
        "The winner is @winnerguy! Congratulations!"
      );
    });

    it("shows message when no entries", async () => {
      mocks.drawWinner.mockResolvedValue(null);

      await giveaway.execute(client, "#channel", "moduser", ["draw"], makeMockMsg());

      expect(say).toHaveBeenCalledWith(
        "#channel",
        expect.stringContaining("No entries")
      );
    });

    it("rejects non-mods", async () => {
      await giveaway.execute(client, "#channel", "viewer", ["draw"], makeMockMsg(false));
      expect(mocks.drawWinner).not.toHaveBeenCalled();
      expect(say).not.toHaveBeenCalled();
    });
  });

  describe("reroll", () => {
    it("rerolls and announces new winner", async () => {
      mocks.drawWinner.mockResolvedValue("newwinner");

      await giveaway.execute(client, "#channel", "moduser", ["reroll"], makeMockMsg());

      expect(mocks.drawWinner).toHaveBeenCalledWith("bc-1");
      expect(say).toHaveBeenCalledWith(
        "#channel",
        "Rerolled! New winner is @newwinner! Congratulations!"
      );
    });

    it("shows message when no entries to reroll", async () => {
      mocks.drawWinner.mockResolvedValue(null);

      await giveaway.execute(client, "#channel", "moduser", ["reroll"], makeMockMsg());

      expect(say).toHaveBeenCalledWith(
        "#channel",
        "@moduser, No entries to reroll."
      );
    });
  });

  describe("end", () => {
    it("ends the giveaway", async () => {
      mocks.getActiveGiveaway.mockResolvedValue({ id: "ga-1" });
      mocks.endGiveaway.mockResolvedValue({});

      await giveaway.execute(client, "#channel", "moduser", ["end"], makeMockMsg());

      expect(mocks.endGiveaway).toHaveBeenCalledWith("bc-1");
      expect(say).toHaveBeenCalledWith("#channel", "Giveaway ended.");
    });

    it("rejects non-mods", async () => {
      await giveaway.execute(client, "#channel", "viewer", ["end"], makeMockMsg(false));
      expect(mocks.endGiveaway).not.toHaveBeenCalled();
      expect(say).not.toHaveBeenCalled();
    });
  });

  describe("count", () => {
    it("shows entry count", async () => {
      mocks.getEntryCount.mockResolvedValue(42);

      await giveaway.execute(client, "#channel", "viewer", ["count"], makeMockMsg(false));

      expect(say).toHaveBeenCalledWith(
        "#channel",
        "There are 42 entries in the current giveaway."
      );
    });
  });

  it("shows usage for unknown subcommand", async () => {
    await giveaway.execute(client, "#channel", "moduser", ["unknown"], makeMockMsg());
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "@moduser, Usage: !giveaway start|draw|reroll|end|count"
    );
  });

  it("shows bot channel not found message", async () => {
    mocks.getBotChannelId.mockReturnValue(undefined);

    await giveaway.execute(client, "#channel", "moduser", ["start", "enter"], makeMockMsg());

    expect(say).toHaveBeenCalledWith("#channel", "@moduser, Bot channel not found.");
  });
});
