import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "$transaction") target[prop] = vi.fn(async (ops: any[]) => Promise.all(ops));
        else if (prop === "$executeRawUnsafe") target[prop] = vi.fn();
        else target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return { prisma: new Proxy(mp, handler), eventBus: { publish: vi.fn() }, logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("@community-bot/db/defaultCommands", () => ({
  DEFAULT_COMMANDS: [{ name: "ping", accessLevel: "EVERYONE" }],
}));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { chatCommandRouter } from "./chatCommand";

const createCaller = t.createCallerFactory(chatCommandRouter);
const p = mocks.prisma;

const BC = { id: "bc-1", userId: "user-1", enabled: true, twitchUserId: "tid" };

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("chatCommandRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns commands for the user's bot channel", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findMany.mockResolvedValue([{ id: "cmd-1", name: "hello" }]);
      const result = await caller.list();
      expect(result).toHaveLength(1);
    });

    it("throws PRECONDITION_FAILED when bot not enabled", async () => {
      const caller = createCaller(mockSession());
      p.botChannel.findUnique.mockResolvedValue(null);
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
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      p.twitchChatCommand.create.mockResolvedValue({ id: "cmd-1", name: "hello" });

      const result = await caller.create({ name: "hello", response: "Hello!" });
      expect(result.id).toBe("cmd-1");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("command:created", { commandId: "cmd-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "command.create" }));
    });

    it("lowercases the command name", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      p.twitchChatCommand.create.mockResolvedValue({ id: "cmd-1", name: "hello" });
      await caller.create({ name: "HELLO", response: "Hi!" });
      expect(p.twitchChatCommand.findUnique).toHaveBeenCalledWith({
        where: { name_botChannelId: { name: "hello", botChannelId: "bc-1" } },
      });
    });

    it("rejects built-in command names", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      await expect(caller.create({ name: "ping", response: "Pong!" })).rejects.toThrow("built-in command");
    });

    it("rejects duplicate command names", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue({ id: "existing" });
      await expect(caller.create({ name: "hello", response: "Hi!" })).rejects.toThrow("already exists");
    });

    it("rejects invalid name characters via zod", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
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
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue({ id: "cmd-1", botChannelId: "bc-1" });
      p.twitchChatCommand.update.mockResolvedValue({ id: "cmd-1", name: "hello", response: "Updated!" });
      const result = await caller.update({ id: UUID, response: "Updated!" });
      expect(result.response).toBe("Updated!");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("command:updated", { commandId: UUID });
    });

    it("throws NOT_FOUND for nonexistent command", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      await expect(caller.update({ id: UUID, response: "test" })).rejects.toThrow("Command not found");
    });

    it("throws NOT_FOUND for command in different channel", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue({ id: "cmd-1", botChannelId: "other-bc" });
      await expect(caller.update({ id: UUID, response: "test" })).rejects.toThrow("Command not found");
    });
  });

  describe("delete", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("deletes command and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue({ id: "cmd-1", name: "hello", botChannelId: "bc-1" });
      p.twitchChatCommand.delete.mockResolvedValue({});
      const result = await caller.delete({ id: UUID });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("command:deleted", { commandId: UUID });
    });

    it("throws NOT_FOUND for nonexistent command", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      await expect(caller.delete({ id: UUID })).rejects.toThrow("Command not found");
    });
  });

  describe("toggleEnabled", () => {
    const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("toggles enabled state and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue({ id: "cmd-1", name: "hello", botChannelId: "bc-1", enabled: true });
      p.twitchChatCommand.update.mockResolvedValue({ id: "cmd-1", enabled: false });
      const result = await caller.toggleEnabled({ id: UUID });
      expect(result.enabled).toBe(false);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "command.toggle" }));
    });

    it("throws NOT_FOUND for nonexistent command", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(BC);
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      await expect(caller.toggleEnabled({ id: UUID })).rejects.toThrow("Command not found");
    });
  });
});
