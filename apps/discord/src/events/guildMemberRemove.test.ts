import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  discordGuild: {
    findUnique: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@community-bot/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("../utils/logger.js", () => ({
  default: mockLogger,
}));

import { guildMemberRemoveEvent } from "./guildMemberRemove.js";
import type { GuildMember, PartialGuildMember, Guild } from "discord.js";

function createMockMember(
  overrides?: Record<string, unknown>
): GuildMember | PartialGuildMember {
  return {
    id: "user-123",
    displayName: "TestUser",
    user: {
      username: "testuser",
      tag: "testuser",
    },
    guild: {
      id: "guild-123",
      name: "Test Server",
      memberCount: 99,
      channels: {
        fetch: vi.fn().mockResolvedValue(null),
      },
    },
    ...overrides,
  } as unknown as GuildMember;
}

function mockGuildData(overrides?: Record<string, unknown>) {
  return {
    id: "db-guild-1",
    guildId: "guild-123",
    leaveEnabled: false,
    leaveChannelId: null,
    leaveMessage: null,
    leaveUseEmbed: false,
    leaveEmbedJson: null,
    ...overrides,
  };
}

describe("guildMemberRemoveEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when guild is not in database", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(null);
    const member = createMockMember();

    await guildMemberRemoveEvent(member);

    expect(member.guild.channels.fetch).not.toHaveBeenCalled();
  });

  it("does nothing when leave messages are disabled", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({ leaveEnabled: false })
    );
    const member = createMockMember();

    await guildMemberRemoveEvent(member);

    expect(member.guild.channels.fetch).not.toHaveBeenCalled();
  });

  it("sends plain text leave message when enabled", async () => {
    const { TextChannel } = await import("discord.js");
    const mockChannel = { send: vi.fn().mockResolvedValue({}) };
    Object.setPrototypeOf(mockChannel, TextChannel.prototype);

    const member = createMockMember({
      guild: {
        id: "guild-123",
        name: "Test Server",
        memberCount: 99,
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      } as unknown as Guild,
    });

    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        leaveEnabled: true,
        leaveChannelId: "channel-1",
        leaveMessage: "{displayName} has left {server}. ({memberCount} members)",
      })
    );

    await guildMemberRemoveEvent(member);

    expect(mockChannel.send).toHaveBeenCalledWith(
      "TestUser has left Test Server. (99 members)"
    );
  });

  it("handles partial guild member (missing user data)", async () => {
    const { TextChannel } = await import("discord.js");
    const mockChannel = { send: vi.fn().mockResolvedValue({}) };
    Object.setPrototypeOf(mockChannel, TextChannel.prototype);

    const partialMember = {
      id: "user-123",
      displayName: null,
      user: null,
      guild: {
        id: "guild-123",
        name: "Test Server",
        memberCount: 99,
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      },
    } as unknown as PartialGuildMember;

    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        leaveEnabled: true,
        leaveChannelId: "channel-1",
        leaveMessage: "{username} left",
      })
    );

    await guildMemberRemoveEvent(partialMember);

    expect(mockChannel.send).toHaveBeenCalledWith("Unknown left");
  });

  it("logs error when channel fetch fails", async () => {
    const member = createMockMember({
      guild: {
        id: "guild-123",
        name: "Test Server",
        memberCount: 99,
        channels: {
          fetch: vi.fn().mockRejectedValue(new Error("Unknown channel")),
        },
      } as unknown as Guild,
    });

    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        leaveEnabled: true,
        leaveChannelId: "bad-channel",
        leaveMessage: "Goodbye!",
      })
    );

    await guildMemberRemoveEvent(member);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Discord - Event (GuildMemberRemove)",
      "Failed to send leave message",
      expect.anything(),
      expect.objectContaining({ guildId: "guild-123" })
    );
  });
});
