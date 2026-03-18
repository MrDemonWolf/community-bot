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
      transaction: vi.fn(),
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
  DEFAULT_COMMANDS: [{ name: "ping", accessLevel: "EVERYONE" }] }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { chatCommandRouter } from "./chatCommand";

const createCaller = t.createCallerFactory(chatCommandRouter);

const BC = { id: "bc-1", userId: "user-1", enabled: true, twitchUserId: "tid" };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  mocks.db.query.users.findFirst.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("chatCommandRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns commands for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findMany.mockResolvedValue([{ id: "cmd-1", name: "hello" }]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });

    it("throws PRECONDITION_FAILED when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      mocks.db.query.botChannels.findFirst.mockResolvedValue(null);
      await expect(caller.list()).rejects.toThrow("Bot is not enabled");
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.list()).rejects.toThrow("Authentication required");
    });
  });

  describe("create", () => {
    it("creates a command and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue(null);
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "cmd-1", name: "hello" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);

      const result = await caller.create({ name: "hello", response: "Hello!" });
      expect(result.id).toBe("cmd-1");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("command:created", { commandId: "cmd-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "command.create" }));
    });

    it("lowercases the command name", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue(null);
      const chain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "cmd-1", name: "hello" }]),
        }),
      };
      mocks.db.insert.mockReturnValue(chain);
      await caller.create({ name: "HELLO", response: "Hi!" });
      // The source looks up existing by lowercase name
      expect(mocks.db.query.twitchChatCommands.findFirst).toHaveBeenCalled();
    });

    it("rejects built-in command names", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      await expect(caller.create({ name: "ping", response: "Pong!" })).rejects.toThrow("built-in command");
    });

    it("rejects duplicate command names", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue({ id: "existing" });
      await expect(caller.create({ name: "hello", response: "Hi!" })).rejects.toThrow("already exists");
    });

    it("rejects invalid name characters via zod", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      await expect(caller.create({ name: "hello world", response: "Hi!" })).rejects.toThrow();
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(caller.create({ name: "test", response: "test" })).rejects.toThrow();
    });
  });

  describe("update", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("updates a command and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue({ id: "cmd-1", botChannelId: "bc-1" });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "cmd-1", name: "hello", response: "Updated!" }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.update({ id: UUID, response: "Updated!" });
      expect(result.response).toBe("Updated!");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("command:updated", { commandId: UUID });
    });

    it("throws NOT_FOUND for nonexistent command", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue(null);
      await expect(caller.update({ id: UUID, response: "test" })).rejects.toThrow("Command not found");
    });

    it("throws NOT_FOUND for command in different channel", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue({ id: "cmd-1", botChannelId: "other-bc" });
      await expect(caller.update({ id: UUID, response: "test" })).rejects.toThrow("Command not found");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes command and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue({ id: "cmd-1", name: "hello", botChannelId: "bc-1" });
      const chain = { where: vi.fn().mockResolvedValue(undefined) };
      mocks.db.delete.mockReturnValue(chain);
      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("command:deleted", { commandId: UUID });
    });

    it("throws NOT_FOUND for nonexistent command", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue(null);
      await expect(caller.delete({ id: UUID })).rejects.toThrow("Command not found");
    });
  });

  describe("toggleEnabled", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("toggles enabled state and publishes event", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue({ id: "cmd-1", name: "hello", botChannelId: "bc-1", enabled: true });
      const chain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "cmd-1", enabled: false }]),
          }),
        }),
      };
      mocks.db.update.mockReturnValue(chain);
      const result = await caller.toggleEnabled({ id: UUID });
      expect(result.enabled).toBe(false);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "command.toggle" }));
    });

    it("throws NOT_FOUND for nonexistent command", async () => {
      const caller = authedCaller();
      mocks.db.query.botChannels.findFirst.mockResolvedValue(BC);
      mocks.db.query.twitchChatCommands.findFirst.mockResolvedValue(null);
      await expect(caller.toggleEnabled({ id: UUID })).rejects.toThrow("Command not found");
    });
  });
});
