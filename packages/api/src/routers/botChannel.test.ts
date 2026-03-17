import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const queryProxy = new Proxy({} as Record<string, any>, {
    get(target, model: string) {
      if (!target[model]) {
        target[model] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[model];
    },
  });
  const chainProxy = (): any => {
    const fns: Record<string, any> = {};
    const p: any = new Proxy({} as any, {
      get(_, prop: string) {
        if (prop === "then") return undefined;
        if (!fns[prop]) fns[prop] = vi.fn().mockReturnValue(p);
        return fns[prop];
      },
    });
    return p;
  };
  return {
    db: {
      query: queryProxy,
      insert: vi.fn(() => chainProxy()),
      update: vi.fn(() => chainProxy()),
      delete: vi.fn(() => chainProxy()),
      select: vi.fn(() => chainProxy()),
      execute: vi.fn(),
      transaction: vi.fn(async (fn: any) => fn({})),
    },
    eventBus: { publish: vi.fn() },
    logAudit: vi.fn(),
  };
});

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
vi.mock("@community-bot/db/defaultCommands", () => ({
  DEFAULT_COMMANDS: [
    { name: "ping", accessLevel: "EVERYONE" },
    { name: "uptime", accessLevel: "EVERYONE" },
    { name: "bot", accessLevel: "BROADCASTER" },
  ] }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { botChannelRouter } from "./botChannel";

const createCaller = t.createCallerFactory(botChannelRouter);

function authedCaller(role = "LEAD_MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("botChannelRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getStatus", () => {
    it("returns status with linked accounts", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.accounts.findFirst.mockResolvedValueOnce({ accountId: "t-123" }).mockResolvedValueOnce({ accountId: "d-456" });
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      mocks.db.query.users.findFirst.mockResolvedValue(null);
      const result = await caller.getStatus();
      expect(result.hasTwitchLinked).toBe(true);
      expect(result.hasDiscordLinked).toBe(true);
      expect(result.botChannel).toBeNull();
    });

    it("returns false when no accounts linked", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.accounts.findFirst.mockResolvedValue(null);
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      const result = await caller.getStatus();
      expect(result.hasTwitchLinked).toBe(false);
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.getStatus()).rejects.toThrow("Authentication required");
    });
  });

  describe("enable", () => {
    it("upserts botChannel and publishes channel:join", async () => {
      const caller = authedCaller();
      mocks.db.query.accounts.findFirst.mockResolvedValue({ accountId: "twitch-id" });
      mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ role: "LEAD_MODERATOR", name: "streamer" }));
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "bc-1", twitchUserId: "twitch-id", twitchUsername: "streamer" }]),
          }),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.enable();
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("channel:join", { channelId: "twitch-id", username: "streamer" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "bot.enable" }));
    });

    it("throws when no Twitch account linked", async () => {
      const caller = authedCaller();
      mocks.db.query.accounts.findFirst.mockResolvedValue(null);
      await expect(caller.enable()).rejects.toThrow("No Twitch account linked");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.enable()).rejects.toThrow();
    });

    it("rejects MODERATOR role", async () => {
      const caller = authedCaller("MODERATOR");
      await expect(caller.enable()).rejects.toThrow();
    });
  });

  describe("disable", () => {
    it("disables bot and publishes channel:leave", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", twitchUserId: "tid", twitchUsername: "s" });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.disable();
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("channel:leave", { channelId: "tid", username: "s" });
    });

    it("throws when bot not enabled", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.disable()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("mute", () => {
    it("mutes bot and publishes bot:mute", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid", twitchUsername: "s" });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.mute({ muted: true });
      expect(result.muted).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("bot:mute", { channelId: "tid", username: "s", muted: true });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "bot.mute" }));
    });

    it("uses bot.unmute action for unmuting", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid", twitchUsername: "s" });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      await caller.mute({ muted: false });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "bot.unmute" }));
    });

    it("throws when bot not enabled", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.mute({ muted: true })).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("updateCommandToggles", () => {
    it("updates disabled commands and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid" });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.updateCommandToggles({ disabledCommands: ["ping"] });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("commands:defaults-updated", { channelId: "tid" });
    });

    it("throws for invalid command names", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      await expect(caller.updateCommandToggles({ disabledCommands: ["nonexistent"] })).rejects.toThrow("Invalid command names");
    });
  });

  describe("updateCommandAccessLevel", () => {
    it("creates override when access level differs from default", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid" });
      const chain = {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.updateCommandAccessLevel({ commandName: "ping", accessLevel: "MODERATOR" });
      expect(result.success).toBe(true);
      expect(mocks.db.insert).toHaveBeenCalled();
    });

    it("deletes override when resetting to default", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      await caller.updateCommandAccessLevel({ commandName: "ping", accessLevel: "EVERYONE" });
      expect(mocks.db.delete).toHaveBeenCalled();
    });

    it("throws for invalid command name", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      await expect(caller.updateCommandAccessLevel({ commandName: "fake", accessLevel: "MODERATOR" })).rejects.toThrow("Invalid command name");
    });
  });

  describe("stats", () => {
    it("returns counts for all resource types", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1", enabled: true });
      const makeSelectChain = (val: number) => ({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: val }]) }),
      });
      mocks.db.select
        .mockReturnValueOnce(makeSelectChain(10))
        .mockReturnValueOnce(makeSelectChain(3))
        .mockReturnValueOnce(makeSelectChain(2))
        .mockReturnValueOnce(makeSelectChain(5))
        .mockReturnValueOnce(makeSelectChain(1));

      const result = await caller.stats();
      expect(result).toEqual({
        quotes: 10,
        counters: 3,
        timers: 2,
        songRequests: 5,
        giveaways: 1 });
    });

    it("returns zeros when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);

      const result = await caller.stats();
      expect(result).toEqual({
        quotes: 0,
        counters: 0,
        timers: 0,
        songRequests: 0,
        giveaways: 0 });
    });
  });
});
