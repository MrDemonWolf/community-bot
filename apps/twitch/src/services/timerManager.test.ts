import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      botChannels: { findFirst: vi.fn() },
      twitchTimers: { findMany: vi.fn() },
    },
  },
  isLive: vi.fn(),
  getGame: vi.fn(),
  getTitle: vi.fn(),
  getMessageCount: vi.fn(),
  resetMessageCount: vi.fn(),
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
vi.mock("./streamStatusManager.js", () => ({
  isLive: mocks.isLive,
  getGame: mocks.getGame,
  getTitle: mocks.getTitle }));
vi.mock("./chatterTracker.js", () => ({
  getMessageCount: mocks.getMessageCount,
  resetMessageCount: mocks.resetMessageCount }));
vi.mock("./commandExecutor.js", () => ({
  substituteVariables: vi.fn(async (msg: string) => msg) }));
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  } }));

import {
  loadTimers,
  stopTimers,
  stopAll,
  getActiveTimerCount,
  setChatClient,
} from "./timerManager.js";

const TIMER_DATA = {
  id: "t1", name: "promo", message: "Follow me!", intervalMinutes: 1, chatLines: 0,
  onlineIntervalSeconds: 60, offlineIntervalSeconds: null,
  enabledWhenOnline: true, enabledWhenOffline: true,
  gameFilter: [], titleKeywords: [], enabled: true,
};

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
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    mocks.db.query.twitchTimers.findMany.mockResolvedValue([TIMER_DATA]);
    mocks.isLive.mockReturnValue(true);
    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(1);
  });

  it("fires timer when conditions met", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    setChatClient({ say } as any);

    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    mocks.db.query.twitchTimers.findMany.mockResolvedValue([
      { ...TIMER_DATA, chatLines: 5 },
    ]);

    mocks.isLive.mockReturnValue(true);
    mocks.getMessageCount.mockReturnValue(10);

    await loadTimers("testchannel");
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(say).toHaveBeenCalledWith("#testchannel", "Follow me!");
    expect(mocks.resetMessageCount).toHaveBeenCalledWith("testchannel");
  });

  it("does not fire when channel is offline and enabledWhenOffline is false", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    setChatClient({ say } as any);

    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    mocks.db.query.twitchTimers.findMany.mockResolvedValue([
      { ...TIMER_DATA, enabledWhenOffline: false },
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

    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    mocks.db.query.twitchTimers.findMany.mockResolvedValue([
      { ...TIMER_DATA, chatLines: 50 },
    ]);

    mocks.isLive.mockReturnValue(true);
    mocks.getMessageCount.mockReturnValue(10);

    await loadTimers("testchannel");
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(say).not.toHaveBeenCalled();
  });

  it("normalizes channel names with # prefix", async () => {
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    mocks.db.query.twitchTimers.findMany.mockResolvedValue([
      { ...TIMER_DATA, onlineIntervalSeconds: 300 },
    ]);
    mocks.isLive.mockReturnValue(true);
    await loadTimers("#TestChannel");
    expect(getActiveTimerCount("testchannel")).toBe(1);
  });

  it("stopAll clears all channels", async () => {
    mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
    mocks.db.query.twitchTimers.findMany.mockResolvedValue([
      { ...TIMER_DATA, onlineIntervalSeconds: 300 },
    ]);
    mocks.isLive.mockReturnValue(true);
    await loadTimers("testchannel");
    expect(getActiveTimerCount("testchannel")).toBe(1);
    stopAll();
    expect(getActiveTimerCount("testchannel")).toBe(0);
  });
});
