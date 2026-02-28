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
  return {
    prisma: new Proxy(mp, handler),
    eventBus: { publish: vi.fn() },
    logAudit: vi.fn(),
    discordFetch: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: mocks.eventBus }));
vi.mock("../utils/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("../utils/discord", () => ({ discordFetch: mocks.discordFetch }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { discordGuildRouter } from "./discordGuild";

const createCaller = t.createCallerFactory(discordGuildRouter);
const p = mocks.prisma;

const GUILD = {
  id: "g-1", guildId: "dg-1", userId: "user-1", name: "Test Server", icon: null,
  enabled: true, notificationChannelId: "ch-1", notificationRoleId: "role-1",
  adminRoleId: null, modRoleId: null,
  joinedAt: new Date("2024-01-01"),
  welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: null,
  welcomeUseEmbed: false, welcomeEmbedJson: null,
  leaveEnabled: false, leaveChannelId: null, leaveMessage: null,
  leaveUseEmbed: false, leaveEmbedJson: null,
  autoRoleEnabled: false, autoRoleId: null,
  dmWelcomeEnabled: false, dmWelcomeMessage: null,
  dmWelcomeUseEmbed: false, dmWelcomeEmbedJson: null,
};

function authedCaller(role = "LEAD_MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

describe("discordGuildRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getStatus", () => {
    it("returns linked guild", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      const result = await caller.getStatus();
      expect(result?.guildId).toBe("dg-1");
    });

    it("returns null when no guild linked", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue(null);
      expect(await caller.getStatus()).toBeNull();
    });

    it("returns adminRoleId and modRoleId in response", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue({ ...GUILD, adminRoleId: "ar-1", modRoleId: "mr-1" });
      const result = await caller.getStatus();
      expect(result?.adminRoleId).toBe("ar-1");
      expect(result?.modRoleId).toBe("mr-1");
    });
  });

  describe("listAvailableGuilds", () => {
    it("returns unlinked guilds", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findMany.mockResolvedValue([{ guildId: "g1", name: "S1", icon: null }]);
      const result = await caller.listAvailableGuilds();
      expect(result).toHaveLength(1);
    });
  });

  describe("getGuildChannels", () => {
    it("returns filtered text/announcement channels", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      mocks.discordFetch.mockResolvedValue([
        { id: "c1", name: "general", type: 0, position: 1 },
        { id: "c2", name: "news", type: 5, position: 2 },
        { id: "c3", name: "voice", type: 2, position: 3 },
      ]);
      const result = await caller.getGuildChannels();
      expect(result).toHaveLength(2);
    });

    it("throws NOT_FOUND when no guild linked", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue(null);
      await expect(caller.getGuildChannels()).rejects.toThrow("No Discord server linked");
    });
  });

  describe("getGuildRoles", () => {
    it("filters out managed roles and @everyone", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      mocks.discordFetch.mockResolvedValue([
        { id: "r1", name: "Admin", color: 0xff0000, position: 3, managed: false },
        { id: "r2", name: "BotRole", color: 0, position: 2, managed: true },
        { id: "r3", name: "@everyone", color: 0, position: 0, managed: false },
      ]);
      const result = await caller.getGuildRoles();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Admin");
    });
  });

  describe("linkGuild", () => {
    it("links guild and publishes event", async () => {
      const caller = authedCaller();
      p.discordGuild.findUnique.mockResolvedValue({ ...GUILD, userId: null });
      p.discordGuild.update.mockResolvedValue(GUILD);
      const result = await caller.linkGuild({ guildId: "dg-1" });
      expect(result.guildId).toBe("dg-1");
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("discord:settings-updated", { guildId: "dg-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.link" }));
    });

    it("throws NOT_FOUND for unknown guild", async () => {
      const caller = authedCaller();
      p.discordGuild.findUnique.mockResolvedValue(null);
      await expect(caller.linkGuild({ guildId: "x" })).rejects.toThrow("Discord server not found");
    });

    it("throws CONFLICT when linked to another user", async () => {
      const caller = authedCaller();
      p.discordGuild.findUnique.mockResolvedValue({ ...GUILD, userId: "other" });
      await expect(caller.linkGuild({ guildId: "dg-1" })).rejects.toThrow("already linked");
    });

    it("rejects MODERATOR role", async () => {
      const caller = authedCaller("MODERATOR");
      await expect(caller.linkGuild({ guildId: "dg-1" })).rejects.toThrow();
    });
  });

  describe("setNotificationChannel", () => {
    it("sets channel and publishes event", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.discordGuild.update.mockResolvedValue({});
      const result = await caller.setNotificationChannel({ channelId: "new-ch" });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.set-channel" }));
    });

    it("throws NOT_FOUND when no guild linked", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(null);
      await expect(caller.setNotificationChannel({ channelId: "ch" })).rejects.toThrow("No Discord server linked");
    });
  });

  describe("setNotificationRole", () => {
    it("sets role and publishes event", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.discordGuild.update.mockResolvedValue({});
      const result = await caller.setNotificationRole({ roleId: "new-role" });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.set-role" }));
    });
  });

  describe("setRoleMapping", () => {
    it("sets admin and mod roles", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.discordGuild.update.mockResolvedValue({});
      const result = await caller.setRoleMapping({ adminRoleId: "ar-1", modRoleId: "mr-1" });
      expect(result.success).toBe(true);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("discord:settings-updated", { guildId: "dg-1" });
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.set-role-mapping" }));
    });

    it("clears role mapping with null values", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue({ ...GUILD, adminRoleId: "ar-1", modRoleId: "mr-1" });
      p.discordGuild.update.mockResolvedValue({});
      const result = await caller.setRoleMapping({ adminRoleId: null, modRoleId: null });
      expect(result.success).toBe(true);
    });

    it("throws NOT_FOUND when no guild linked", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(null);
      await expect(caller.setRoleMapping({ adminRoleId: null, modRoleId: null })).rejects.toThrow("No Discord server linked");
    });

    it("rejects MODERATOR role", async () => {
      const caller = authedCaller("MODERATOR");
      await expect(caller.setRoleMapping({ adminRoleId: null, modRoleId: null })).rejects.toThrow();
    });
  });

  describe("enable", () => {
    it("enables notifications", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.discordGuild.update.mockResolvedValue({});
      expect((await caller.enable()).success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.enable" }));
    });
  });

  describe("disable", () => {
    it("disables notifications", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.discordGuild.update.mockResolvedValue({});
      expect((await caller.disable()).success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.disable" }));
    });
  });

  describe("listMonitoredChannels", () => {
    it("returns monitored channels", async () => {
      const caller = createCaller(mockSession());
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.twitchChannel.findMany.mockResolvedValue([{
        id: "tc-1", twitchChannelId: "t1", username: "streamer", displayName: "Streamer",
        profileImageUrl: null, isLive: false, notificationChannelId: null, notificationRoleId: null,
        updateMessageLive: false, deleteWhenOffline: false, autoPublish: false,
        useCustomMessage: false, customOnlineMessage: null, customOfflineMessage: null,
      }]);
      const result = await caller.listMonitoredChannels();
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("streamer");
    });
  });

  describe("updateChannelSettings", () => {
    it("updates settings and publishes event", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.twitchChannel.findFirst.mockResolvedValue({ id: "tc-1", displayName: "S", username: "s" });
      p.twitchChannel.update.mockResolvedValue({});
      const result = await caller.updateChannelSettings({ channelId: "tc-1", autoPublish: true });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.channel-settings" }));
    });

    it("throws NOT_FOUND for unknown channel", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.twitchChannel.findFirst.mockResolvedValue(null);
      await expect(caller.updateChannelSettings({ channelId: "x" })).rejects.toThrow("Monitored channel not found");
    });
  });

  describe("updateWelcomeSettings", () => {
    it("updates welcome settings", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      p.discordGuild.update.mockResolvedValue({});
      const result = await caller.updateWelcomeSettings({ welcomeEnabled: true });
      expect(result.success).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "discord.welcome-settings" }));
    });
  });

  describe("testWelcomeMessage", () => {
    it("publishes test welcome event", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      await caller.testWelcomeMessage({ type: "welcome" });
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("discord:test-welcome", { guildId: "dg-1", type: "welcome" });
    });
  });

  describe("testNotification", () => {
    it("publishes test notification", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue(GUILD);
      await caller.testNotification();
      expect(mocks.eventBus.publish).toHaveBeenCalledWith("discord:test-notification", { guildId: "dg-1" });
    });

    it("throws PRECONDITION_FAILED when no notification channel set", async () => {
      const caller = authedCaller();
      p.discordGuild.findFirst.mockResolvedValue({ ...GUILD, notificationChannelId: null });
      await expect(caller.testNotification()).rejects.toThrow("Set a notification channel first");
    });
  });
});
