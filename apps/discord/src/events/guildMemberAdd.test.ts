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

import { guildMemberAddEvent } from "./guildMemberAdd.js";
import type { GuildMember, TextChannel, Guild } from "discord.js";

function createMockMember(overrides?: Partial<GuildMember>): GuildMember {
  const mockChannel = {
    send: vi.fn().mockResolvedValue({}),
  } as unknown as TextChannel;

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
      memberCount: 100,
      channels: {
        fetch: vi.fn().mockResolvedValue(mockChannel),
      },
    },
    send: vi.fn().mockResolvedValue({}),
    roles: {
      add: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as GuildMember;
}

function mockGuildData(overrides?: Record<string, unknown>) {
  return {
    id: "db-guild-1",
    guildId: "guild-123",
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: null,
    welcomeUseEmbed: false,
    welcomeEmbedJson: null,
    leaveEnabled: false,
    leaveChannelId: null,
    leaveMessage: null,
    leaveUseEmbed: false,
    leaveEmbedJson: null,
    autoRoleEnabled: false,
    autoRoleId: null,
    dmWelcomeEnabled: false,
    dmWelcomeMessage: null,
    dmWelcomeUseEmbed: false,
    dmWelcomeEmbedJson: null,
    ...overrides,
  };
}

// We need to ensure TextChannel instanceof check works
vi.mock("discord.js", async () => {
  const actual = await vi.importActual("discord.js");
  return actual;
});

describe("guildMemberAddEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when guild is not in database", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(null);
    const member = createMockMember();

    await guildMemberAddEvent(member);

    expect(member.guild.channels.fetch).not.toHaveBeenCalled();
  });

  it("sends plain text welcome message when enabled", async () => {
    const mockChannel = {
      send: vi.fn().mockResolvedValue({}),
      constructor: { name: "TextChannel" },
    };

    // We need to create a proper TextChannel-like object
    const { TextChannel } = await import("discord.js");
    Object.setPrototypeOf(mockChannel, TextChannel.prototype);

    const member = createMockMember({
      guild: {
        id: "guild-123",
        name: "Test Server",
        memberCount: 100,
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      } as unknown as Guild,
    });

    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        welcomeEnabled: true,
        welcomeChannelId: "channel-1",
        welcomeMessage: "Welcome {displayName} to {server}!",
      })
    );

    await guildMemberAddEvent(member);

    expect(member.guild.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(mockChannel.send).toHaveBeenCalledWith(
      "Welcome TestUser to Test Server!"
    );
  });

  it("sends DM welcome when enabled", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        dmWelcomeEnabled: true,
        dmWelcomeMessage: "Welcome {displayName}!",
      })
    );

    const member = createMockMember();
    await guildMemberAddEvent(member);

    expect(member.send).toHaveBeenCalledWith("Welcome TestUser!");
  });

  it("logs error when DM fails (user has DMs disabled)", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        dmWelcomeEnabled: true,
        dmWelcomeMessage: "Welcome!",
      })
    );

    const member = createMockMember();
    (member.send as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Cannot send messages to this user")
    );

    await guildMemberAddEvent(member);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Discord - Event (GuildMemberAdd)",
      "Failed to send DM welcome (user may have DMs disabled)",
      expect.anything(),
      expect.objectContaining({ userId: "user-123" })
    );
  });

  it("assigns auto-role when enabled", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        autoRoleEnabled: true,
        autoRoleId: "role-456",
      })
    );

    const member = createMockMember();
    await guildMemberAddEvent(member);

    expect(member.roles.add).toHaveBeenCalledWith("role-456");
  });

  it("logs error when auto-role assignment fails", async () => {
    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        autoRoleEnabled: true,
        autoRoleId: "role-456",
      })
    );

    const member = createMockMember();
    (member.roles.add as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Missing permissions")
    );

    await guildMemberAddEvent(member);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Discord - Event (GuildMemberAdd)",
      "Failed to assign auto-role",
      expect.anything(),
      expect.objectContaining({ roleId: "role-456" })
    );
  });

  it("performs all three actions independently", async () => {
    const { TextChannel } = await import("discord.js");
    const mockChannel = { send: vi.fn().mockResolvedValue({}) };
    Object.setPrototypeOf(mockChannel, TextChannel.prototype);

    const member = createMockMember({
      guild: {
        id: "guild-123",
        name: "Test Server",
        memberCount: 100,
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      } as unknown as Guild,
    });

    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        welcomeEnabled: true,
        welcomeChannelId: "channel-1",
        welcomeMessage: "Welcome!",
        dmWelcomeEnabled: true,
        dmWelcomeMessage: "DM Welcome!",
        autoRoleEnabled: true,
        autoRoleId: "role-1",
      })
    );

    await guildMemberAddEvent(member);

    expect(mockChannel.send).toHaveBeenCalledWith("Welcome!");
    expect(member.send).toHaveBeenCalledWith("DM Welcome!");
    expect(member.roles.add).toHaveBeenCalledWith("role-1");
  });

  it("does not send welcome when channel fetch fails", async () => {
    const member = createMockMember({
      guild: {
        id: "guild-123",
        name: "Test Server",
        memberCount: 100,
        channels: {
          fetch: vi.fn().mockRejectedValue(new Error("Unknown channel")),
        },
      } as unknown as Guild,
    });

    mockPrisma.discordGuild.findUnique.mockResolvedValue(
      mockGuildData({
        welcomeEnabled: true,
        welcomeChannelId: "bad-channel",
        welcomeMessage: "Welcome!",
      })
    );

    await guildMemberAddEvent(member);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Discord - Event (GuildMemberAdd)",
      "Failed to send welcome message",
      expect.anything(),
      expect.objectContaining({ guildId: "guild-123" })
    );
  });
});
