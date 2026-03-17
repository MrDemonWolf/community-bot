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

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { t } from "../index";
import { pollRouter } from "./poll";

const createCaller = t.createCallerFactory(pollRouter);

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

function setupHelixAuth() {
  mocks.db.query.accounts.findFirst.mockResolvedValue({ accountId: "twitch-123" });
  mocks.db.query.twitchCredentials.findFirst.mockResolvedValue({
    accessToken: "test-token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600000),
  });
}

describe("pollRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWITCH_APPLICATION_CLIENT_ID = "test-client-id";
  });

  describe("list", () => {
    it("returns polls from Twitch API", async () => {
      const caller = createCaller(mockSession());
      setupHelixAuth();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "poll-1", title: "Test Poll", status: "ACTIVE", choices: [] }] }),
      });
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });

    it("throws when no Twitch credentials", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.accounts.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow();
    });
  });

  describe("create", () => {
    it("creates a poll via Twitch API", async () => {
      const caller = authedCaller();
      setupHelixAuth();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "poll-1", title: "Test" }] }),
      });
      const result = await caller.create({ title: "Test", choices: ["A", "B"] });
      expect(result).toBeTruthy();
    });
  });

  describe("end", () => {
    it("ends a poll via Twitch API", async () => {
      const caller = authedCaller();
      setupHelixAuth();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "poll-1", status: "TERMINATED" }] }),
      });
      const result = await caller.end({ id: "poll-1" });
      expect(result).toBeTruthy();
    });
  });
});
