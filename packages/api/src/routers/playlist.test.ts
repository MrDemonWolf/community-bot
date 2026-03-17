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
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { playlistRouter } from "./playlist";

const createCaller = t.createCallerFactory(playlistRouter);

const BC = { id: "bc-1", userId: "user-1", enabled: true };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("playlistRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns playlists for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlists.findMany.mockResolvedValue([
        { id: "p-1", name: "Chill", createdAt: new Date(), updatedAt: new Date() },
      ]);
      const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ value: 5 }]) }) };
      mocks.db.select.mockReturnValue(selectChain);
      mocks.db.query.songRequestSettings.findFirst.mockResolvedValue(null);
      const result = await caller.list();
      expect(result.playlists).toHaveLength(1);
    });

    it("throws when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("create", () => {
    it("creates a playlist", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlists.findFirst.mockResolvedValue(null);
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "p-1", name: "Chill" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.create({ name: "Chill" });
      expect(result.id).toBe("p-1");
    });

    it("rejects duplicate playlist names", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlists.findFirst.mockResolvedValue({ id: "existing" });
      await expect(caller.create({ name: "Chill" })).rejects.toThrow("already exists");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes a playlist", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlists.findFirst.mockResolvedValue({ id: UUID, name: "Chill", botChannelId: "bc-1" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
    });

    it("throws NOT_FOUND for missing playlist", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlists.findFirst.mockResolvedValue(null);
      await expect(caller.delete({ id: UUID })).rejects.toThrow("Playlist not found");
    });
  });

  describe("addEntry", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("adds an entry to a playlist", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlists.findFirst.mockResolvedValue({ id: UUID, botChannelId: "bc-1" });
      mocks.db.query.playlistEntries.findFirst.mockResolvedValue({ position: 3 });
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "pe-1", position: 4, title: "Song" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      const result = await caller.addEntry({ playlistId: UUID, title: "Song" });
      expect(result).toBeTruthy();
    });
  });

  describe("removeEntry", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("removes an entry from a playlist", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.playlistEntries.findFirst.mockResolvedValue({ id: UUID, playlistId: "p-1", playlist: { botChannelId: "bc-1" } });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      const result = await caller.removeEntry({ id: UUID });
      expect(result.success).toBe(true);
    });
  });
});
