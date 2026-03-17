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
      transaction: vi.fn(async (fn: any) => fn({
        insert: vi.fn(() => chainProxy()),
        update: vi.fn(() => chainProxy()),
        delete: vi.fn(() => chainProxy()),
        select: vi.fn(() => chainProxy()),
        execute: vi.fn(),
      })),
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
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost", DISCORD_BOT_TOKEN: "test-token" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { discordGuildRouter } from "./discordGuild";

const createCaller = t.createCallerFactory(discordGuildRouter);

function authedCaller(role = "LEAD_MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("discordGuildRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getStatus", () => {
    it("returns null when no guild linked", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue(null);
      const result = await caller.getStatus();
      expect(result).toBeNull();
    });

    it("returns guild data when linked", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue({
        id: "dg-1", guildId: "g-123", name: "Test", icon: null,
        notificationChannelId: "ch-1", notificationRoleId: "r-1",
        adminRoleId: null, modRoleId: null,
        enabled: true, muted: false, userId: "user-1",
        joinedAt: new Date("2024-01-01"),
      });
      const result = await caller.getStatus();
      expect(result).toBeTruthy();
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.getStatus()).rejects.toThrow("Authentication required");
    });
  });

  describe("linkGuild", () => {
    it("links a guild to the user", async () => {
      const caller = authedCaller();
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue({ id: "dg-1", guildId: "g-123", userId: null });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              id: "dg-1", guildId: "g-123", name: "Test", icon: null,
              enabled: false, muted: false, userId: "user-1",
              notificationChannelId: null, notificationRoleId: null,
              adminRoleId: null, modRoleId: null,
              joinedAt: new Date("2024-01-01"),
            }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.linkGuild({ guildId: "g-123" });
      expect(result).toBeTruthy();
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.link" }));
    });
  });

  describe("setNotificationChannel", () => {
    it("updates notification channel", async () => {
      const caller = authedCaller();
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue({ id: "dg-1", guildId: "g-123", userId: "user-1" });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.setNotificationChannel({ channelId: "ch-new" });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.set-channel" }));
    });

    it("throws when no guild linked", async () => {
      const caller = authedCaller();
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue(null);
      await expect(caller.setNotificationChannel({ channelId: "ch" })).rejects.toThrow();
    });
  });

  describe("enable", () => {
    it("enables notifications", async () => {
      const caller = authedCaller();
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue({ id: "dg-1", guildId: "g-123", userId: "user-1", enabled: false });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.enable();
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("discord:settings-updated", { guildId: "g-123" });
    });
  });

  describe("disable", () => {
    it("disables notifications", async () => {
      const caller = authedCaller();
      mocks.db.query.discordGuilds.findFirst.mockResolvedValue({ id: "dg-1", guildId: "g-123", userId: "user-1", enabled: true });
      const chain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.disable();
      expect(result.success).toBe(true);
    });
  });
});
