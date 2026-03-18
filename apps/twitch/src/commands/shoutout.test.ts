import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      botChannels: { findFirst: vi.fn() },
    },
  },
  helixFetch: vi.fn(),
  generateShoutout: vi.fn(),
  isAiShoutoutGloballyEnabled: vi.fn(),
}));

vi.mock("../services/helixClient.js", () => ({
  helixFetch: mocks.helixFetch }));
vi.mock("../services/aiShoutout.js", () => ({
  generateShoutout: mocks.generateShoutout,
  isAiShoutoutGloballyEnabled: mocks.isAiShoutoutGloballyEnabled }));
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

import { shoutout } from "./shoutout.js";

function makeMockMsg(isMod = true) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("shoutout command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(false);
  });

  it("does nothing if user is not a mod", async () => {
    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg(false));
    expect(say).not.toHaveBeenCalled();
  });

  it("shows usage when no args", async () => {
    await shoutout.execute(client, "#channel", "testuser", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", "@testuser, usage: !so <username>");
  });

  it("shouts out a user with game info", async () => {
    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "Fortnite",
          title: "Playing Fortnite",
        }] });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "Go check out Target at https://twitch.tv/target ! They were last playing Fortnite."
    );
  });

  it("shouts out without game when none set", async () => {
    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }] });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "Go check out Target at https://twitch.tv/target !"
    );
  });

  it("shows error when user not found", async () => {
    mocks.helixFetch.mockResolvedValueOnce({ data: [] });
    await shoutout.execute(client, "#channel", "testuser", ["nobody"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#channel", '@testuser, could not find channel "nobody".');
  });

  it("sends AI shoutout when enabled for channel", async () => {
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(true);
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ aiShoutoutEnabled: true });
    mocks.generateShoutout.mockResolvedValue("AI says: Target is awesome!");

    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "Fortnite",
          title: "",
        }] });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());

    expect(say).toHaveBeenCalledTimes(2);
    expect(say).toHaveBeenCalledWith("#channel", "AI says: Target is awesome!");
  });

  it("does not send AI shoutout when disabled for channel", async () => {
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(true);
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ aiShoutoutEnabled: false });

    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }] });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());

    expect(say).toHaveBeenCalledTimes(1);
    expect(mocks.generateShoutout).not.toHaveBeenCalled();
  });

  it("still sends standard shoutout when AI fails", async () => {
    mocks.isAiShoutoutGloballyEnabled.mockReturnValue(true);
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ aiShoutoutEnabled: true });
    mocks.generateShoutout.mockRejectedValue(new Error("API Error"));

    mocks.helixFetch
      .mockResolvedValueOnce({ data: [{ id: "999", login: "target", display_name: "Target" }] })
      .mockResolvedValueOnce({
        data: [{
          broadcaster_id: "999",
          broadcaster_login: "target",
          broadcaster_name: "Target",
          game_name: "",
          title: "",
        }] });

    await shoutout.execute(client, "#channel", "testuser", ["target"], makeMockMsg());

    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith(
      "#channel",
      "Go check out Target at https://twitch.tv/target !"
    );
  });
});
