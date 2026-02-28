import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return { prisma: new Proxy(mp, handler), eventBus: { publish: vi.fn() }, logAudit: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { userRouter } from "./user";

const createCaller = t.createCallerFactory(userRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("userRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getProfile", () => {
    it("returns profile with connected accounts", async () => {
      const caller = createCaller(mockSession());
      p.user.findUnique.mockResolvedValue({ ...mockUser(), accounts: [{ providerId: "twitch", accountId: "t-1" }] });
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
      const result = await caller.getProfile();
      expect(result.name).toBe("TestUser");
      expect(result.isChannelOwner).toBe(true);
      expect(result.connectedAccounts).toHaveLength(1);
    });

    it("throws NOT_FOUND when user doesn't exist", async () => {
      const caller = createCaller(mockSession());
      p.user.findUnique.mockResolvedValue(null);
      await expect(caller.getProfile()).rejects.toThrow("User not found");
    });

    it("throws UNAUTHORIZED without session", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.getProfile()).rejects.toThrow("Authentication required");
    });
  });

  describe("exportData", () => {
    it("returns full user data export", async () => {
      const caller = createCaller(mockSession());
      p.user.findUnique.mockResolvedValue({
        ...mockUser(), accounts: [{ providerId: "twitch", accountId: "t-1", scope: "read" }],
        botChannel: { twitchUsername: "test", twitchUserId: "t-1", enabled: true, muted: false, disabledCommands: [], commandOverrides: [], customCommands: [] },
      });
      const result = await caller.exportData();
      expect(result.profile.name).toBe("TestUser");
      expect(result.botChannel).not.toBeNull();
    });

    it("returns null botChannel when none exists", async () => {
      const caller = createCaller(mockSession());
      p.user.findUnique.mockResolvedValue({ ...mockUser(), accounts: [], botChannel: null });
      const result = await caller.exportData();
      expect(result.botChannel).toBeNull();
    });
  });

  describe("importStreamElements", () => {
    it("imports commands and publishes events", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      p.twitchChatCommand.create.mockResolvedValue({ id: "cmd-1" });
      const result = await caller.importStreamElements({
        commands: [
          { command: "!hello", response: "Hello!" },
          { command: "!bye", response: "Goodbye!", accessLevel: 500 },
        ],
      });
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mocks.eventBus.publish).toHaveBeenCalledTimes(2);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "import.streamelements" }));
    });

    it("skips existing commands", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchChatCommand.findUnique.mockResolvedValue({ id: "existing" });
      const result = await caller.importStreamElements({ commands: [{ command: "!hello", response: "Hi!" }] });
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("skips invalid names", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      const result = await caller.importStreamElements({ commands: [{ command: "!hello world", response: "Hi!" }] });
      expect(result.skipped).toBe(1);
    });

    it("maps SE access levels correctly", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      p.twitchChatCommand.findUnique.mockResolvedValue(null);
      p.twitchChatCommand.create.mockResolvedValue({ id: "cmd-1" });
      await caller.importStreamElements({ commands: [{ command: "!mod", response: "mod cmd", accessLevel: 500 }] });
      expect(p.twitchChatCommand.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accessLevel: "MODERATOR" }) });
    });

    it("throws PRECONDITION_FAILED when bot not enabled", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(null);
      await expect(caller.importStreamElements({ commands: [{ command: "!test", response: "test" }] })).rejects.toThrow("Bot is not enabled");
    });
  });
});
