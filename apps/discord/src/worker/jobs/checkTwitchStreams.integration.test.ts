import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedDiscordGuild,
} from "@community-bot/db/test-client";

vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});

const mockGetStreams = vi.fn();
vi.mock("../../twitch/api.js", () => ({
  getStreams: mockGetStreams,
}));
vi.mock("../../twitch/embeds.js", () => ({
  buildLiveEmbed: vi.fn(() => ({ data: { title: "LIVE" } })),
  buildOfflineEmbed: vi.fn(() => ({ data: { title: "OFFLINE" } })),
  buildCustomEmbed: vi.fn(() => ({ data: { title: "CUSTOM" } })),
  formatDuration: vi.fn(() => "1h 30m"),
}));
vi.mock("../../utils/logger.js", () => ({
  default: {
    twitch: { streamOnline: vi.fn(), streamOffline: vi.fn() },
    discord: { notification: vi.fn() },
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    database: { operation: vi.fn() },
  },
}));

import {
  resolveNotificationChannelId,
  resolveRoleMention,
} from "./checkTwitchStreams.js";

describe("checkTwitchStreams (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  describe("resolveNotificationChannelId", () => {
    it("uses per-channel override when set", () => {
      const result = resolveNotificationChannelId(
        { notificationChannelId: "chan-override" },
        { notificationChannelId: "guild-default" }
      );
      expect(result).toBe("chan-override");
    });

    it("falls back to guild default when channel has no override", () => {
      const result = resolveNotificationChannelId(
        { notificationChannelId: null },
        { notificationChannelId: "guild-default" }
      );
      expect(result).toBe("guild-default");
    });

    it("returns null when neither is set", () => {
      const result = resolveNotificationChannelId(
        { notificationChannelId: null },
        { notificationChannelId: null }
      );
      expect(result).toBeNull();
    });
  });

  describe("resolveRoleMention", () => {
    it("formats @everyone role", () => {
      const result = resolveRoleMention(
        { notificationRoleId: null },
        { notificationRoleId: "everyone" }
      );
      expect(result).toBe("@everyone");
    });

    it("formats role mention with ID", () => {
      const result = resolveRoleMention(
        { notificationRoleId: "123456" },
        { notificationRoleId: null }
      );
      expect(result).toBe("<@&123456>");
    });

    it("returns empty string when no role set", () => {
      const result = resolveRoleMention(
        { notificationRoleId: null },
        { notificationRoleId: null }
      );
      expect(result).toBe("");
    });
  });

  describe("DB setup for stream checks", () => {
    it("creates TwitchChannel with guild association", async () => {
      const guild = await seedDiscordGuild(testPrisma, {
        guildId: "guild-1",
        name: "Stream Guild",
      });

      const channel = await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "twitch-123",
          username: "teststreamer",
          displayName: "TestStreamer",
          guildId: guild.id,
        },
      });

      expect(channel.guildId).toBe(guild.id);

      // Verify the query pattern used by checkTwitchStreams
      const monitored = await testPrisma.twitchChannel.findMany({
        where: { guildId: { not: null } },
        include: {
          DiscordGuild: true,
          TwitchNotification: {
            where: { isLive: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      expect(monitored).toHaveLength(1);
      expect(monitored[0].DiscordGuild).not.toBeNull();
      expect(monitored[0].DiscordGuild!.name).toBe("Stream Guild");
    });

    it("skips channels with disabled guilds", async () => {
      const enabledGuild = await seedDiscordGuild(testPrisma, {
        guildId: "g-enabled",
        enabled: true,
      });
      const disabledGuild = await seedDiscordGuild(testPrisma, {
        guildId: "g-disabled",
        enabled: false,
      });

      await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "tc-1",
          username: "streamer1",
          guildId: enabledGuild.id,
        },
      });
      await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "tc-2",
          username: "streamer2",
          guildId: disabledGuild.id,
        },
      });

      const channels = await testPrisma.twitchChannel.findMany({
        where: { guildId: { not: null } },
        include: { DiscordGuild: true },
      });

      const activeChannels = channels.filter(
        (c) => c.DiscordGuild?.enabled !== false
      );
      expect(activeChannels).toHaveLength(1);
      expect(activeChannels[0].username).toBe("streamer1");
    });

    it("creates and queries TwitchNotification records", async () => {
      const guild = await seedDiscordGuild(testPrisma, { guildId: "g-notif" });

      const channel = await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "tc-notif",
          username: "notifstreamer",
          guildId: guild.id,
        },
      });

      // Simulate a live notification being created (as checkTwitchStreams does)
      await testPrisma.twitchNotification.create({
        data: {
          messageId: "msg-123",
          channelId: "discord-chan-1",
          guildId: guild.guildId,
          twitchChannelId: channel.id,
          isLive: true,
          streamStartedAt: new Date(),
        },
      });

      // Verify the query pattern
      const withNotifs = await testPrisma.twitchChannel.findMany({
        where: { guildId: { not: null } },
        include: {
          DiscordGuild: true,
          TwitchNotification: {
            where: { isLive: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      expect(withNotifs[0].TwitchNotification).toHaveLength(1);
      expect(withNotifs[0].TwitchNotification[0].messageId).toBe("msg-123");
    });

    it("multiple guilds monitoring same Twitch channel", async () => {
      const guild1 = await seedDiscordGuild(testPrisma, {
        guildId: "g-multi-1",
        name: "Guild 1",
      });
      const guild2 = await seedDiscordGuild(testPrisma, {
        guildId: "g-multi-2",
        name: "Guild 2",
      });

      // Same Twitch channel ID but different guild associations
      await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "shared-streamer",
          username: "sharedstreamer",
          guildId: guild1.id,
        },
      });
      await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "shared-streamer",
          username: "sharedstreamer",
          guildId: guild2.id,
        },
      });

      const channels = await testPrisma.twitchChannel.findMany({
        where: { twitchChannelId: "shared-streamer" },
        include: { DiscordGuild: true },
      });

      expect(channels).toHaveLength(2);
      const guildNames = channels.map((c) => c.DiscordGuild!.name).sort();
      expect(guildNames).toEqual(["Guild 1", "Guild 2"]);
    });

    it("updates stream status fields on TwitchChannel", async () => {
      const guild = await seedDiscordGuild(testPrisma, { guildId: "g-status" });

      const channel = await testPrisma.twitchChannel.create({
        data: {
          twitchChannelId: "tc-status",
          username: "statusstreamer",
          guildId: guild.id,
          isLive: false,
        },
      });

      // Simulate going live
      await testPrisma.twitchChannel.update({
        where: { id: channel.id },
        data: {
          isLive: true,
          lastStreamTitle: "Playing Minecraft!",
          lastGameName: "Minecraft",
          lastStartedAt: new Date(),
        },
      });

      const updated = await testPrisma.twitchChannel.findUnique({
        where: { id: channel.id },
      });
      expect(updated!.isLive).toBe(true);
      expect(updated!.lastStreamTitle).toBe("Playing Minecraft!");
    });
  });
});
