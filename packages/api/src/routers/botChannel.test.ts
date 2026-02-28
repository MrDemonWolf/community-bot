import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

// Create mocks inside vi.hoisted so they're available in vi.mock factories
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
  return {
    prisma: new Proxy(mp, handler),
    eventBus: { publish: vi.fn() },
    logAudit: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("@community-bot/db/defaultCommands", () => ({
  DEFAULT_COMMANDS: [
    { name: "ping", accessLevel: "EVERYONE" },
    { name: "uptime", accessLevel: "EVERYONE" },
    { name: "bot", accessLevel: "BROADCASTER" },
  ],
}));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { botChannelRouter } from "./botChannel";

const createCaller = t.createCallerFactory(botChannelRouter);
const p = mocks.prisma;

function authedCaller(role = "LEAD_MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("botChannelRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getStatus", () => {
    it("returns status with linked accounts", async () => {
      const caller = createCaller(mockSession());
      p.account.findFirst.mockResolvedValueOnce({ accountId: "t-123" }).mockResolvedValueOnce({ accountId: "d-456" });
      p.botChannel.findUnique.mockResolvedValue(null);
      p.user.findUnique.mockResolvedValue(null);
      const result = await caller.getStatus();
      expect(result.hasTwitchLinked).toBe(true);
      expect(result.hasDiscordLinked).toBe(true);
      expect(result.botChannel).toBeNull();
    });

    it("returns false when no accounts linked", async () => {
      const caller = createCaller(mockSession());
      p.account.findFirst.mockResolvedValue(null);
      p.botChannel.findUnique.mockResolvedValue(null);
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
      p.account.findFirst.mockResolvedValue({ accountId: "twitch-id" });
      p.user.findUnique.mockResolvedValue(mockUser({ role: "LEAD_MODERATOR", name: "streamer" }));
      p.botChannel.upsert.mockResolvedValue({ id: "bc-1", twitchUserId: "twitch-id", twitchUsername: "streamer" });
      const result = await caller.enable();
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("channel:join", { channelId: "twitch-id", username: "streamer" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "bot.enable" }));
    });

    it("throws when no Twitch account linked", async () => {
      const caller = authedCaller();
      p.account.findFirst.mockResolvedValue(null);
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
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", twitchUserId: "tid", twitchUsername: "s" });
      p.botChannel.update.mockResolvedValue({});
      const result = await caller.disable();
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("channel:leave", { channelId: "tid", username: "s" });
    });

    it("throws when bot not enabled", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(null);
      await expect(caller.disable()).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("mute", () => {
    it("mutes bot and publishes bot:mute", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid", twitchUsername: "s" });
      p.botChannel.update.mockResolvedValue({});
      const result = await caller.mute({ muted: true });
      expect(result.muted).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("bot:mute", { channelId: "tid", username: "s", muted: true });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "bot.mute" }));
    });

    it("uses bot.unmute action for unmuting", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid", twitchUsername: "s" });
      p.botChannel.update.mockResolvedValue({});
      await caller.mute({ muted: false });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "bot.unmute" }));
    });

    it("throws when bot not enabled", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue(null);
      await expect(caller.mute({ muted: true })).rejects.toThrow("Bot is not enabled");
    });
  });

  describe("updateCommandToggles", () => {
    it("updates disabled commands and publishes event", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid" });
      p.botChannel.update.mockResolvedValue({});
      const result = await caller.updateCommandToggles({ disabledCommands: ["ping"] });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("commands:defaults-updated", { channelId: "tid" });
    });

    it("throws for invalid command names", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      await expect(caller.updateCommandToggles({ disabledCommands: ["nonexistent"] })).rejects.toThrow("Invalid command names");
    });
  });

  describe("updateCommandAccessLevel", () => {
    it("creates override when access level differs from default", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid" });
      p.defaultCommandOverride.upsert.mockResolvedValue({});
      const result = await caller.updateCommandAccessLevel({ commandName: "ping", accessLevel: "MODERATOR" });
      expect(result.success).toBe(true);
      expect(p.defaultCommandOverride.upsert).toHaveBeenCalled();
    });

    it("deletes override when resetting to default", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true, twitchUserId: "tid" });
      p.defaultCommandOverride.deleteMany.mockResolvedValue({});
      await caller.updateCommandAccessLevel({ commandName: "ping", accessLevel: "EVERYONE" });
      expect(p.defaultCommandOverride.deleteMany).toHaveBeenCalled();
    });

    it("throws for invalid command name", async () => {
      const caller = authedCaller();
      p.botChannel.findUnique.mockResolvedValue({ id: "bc-1", enabled: true });
      await expect(caller.updateCommandAccessLevel({ commandName: "fake", accessLevel: "MODERATOR" })).rejects.toThrow("Invalid command name");
    });
  });
});
