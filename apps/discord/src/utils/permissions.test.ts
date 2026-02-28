import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionFlagsBits, Collection } from "discord.js";
import type { ChatInputCommandInteraction, GuildMemberRoleManager } from "discord.js";

const mocks = vi.hoisted(() => ({
  prisma: {
    discordGuild: { findFirst: vi.fn() },
  },
}));

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));

import { hasPermission, clearGuildRoleCache } from "./permissions.js";

function makeInteraction(opts: {
  guildId?: string | null;
  roleIds?: string[];
  permissions?: bigint[];
}): ChatInputCommandInteraction {
  const roleCache = new Collection<string, { id: string }>();
  for (const id of opts.roleIds ?? []) {
    roleCache.set(id, { id });
  }

  const permBits = {
    has: (flag: bigint) => (opts.permissions ?? []).includes(flag),
  };

  return {
    guildId: opts.guildId ?? "guild-1",
    member: {
      roles: { cache: roleCache },
      permissions: permBits,
    },
  } as unknown as ChatInputCommandInteraction;
}

describe("hasPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGuildRoleCache("guild-1");
  });

  describe("admin level", () => {
    it("grants access when user has configured adminRoleId", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: "admin-role",
        modRoleId: null,
      });

      const interaction = makeInteraction({ roleIds: ["admin-role"] });
      expect(await hasPermission(interaction, "admin")).toBe(true);
    });

    it("falls back to ManageGuild when no adminRoleId configured", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: null,
        modRoleId: null,
      });

      const interaction = makeInteraction({
        permissions: [PermissionFlagsBits.ManageGuild],
      });
      expect(await hasPermission(interaction, "admin")).toBe(true);
    });

    it("denies access without role or permission", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: "admin-role",
        modRoleId: null,
      });

      const interaction = makeInteraction({ roleIds: [], permissions: [] });
      expect(await hasPermission(interaction, "admin")).toBe(false);
    });

    it("denies when user has modRoleId but not adminRoleId for admin check", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: "admin-role",
        modRoleId: "mod-role",
      });

      const interaction = makeInteraction({ roleIds: ["mod-role"] });
      expect(await hasPermission(interaction, "admin")).toBe(false);
    });
  });

  describe("mod level", () => {
    it("grants access when user has configured modRoleId", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: null,
        modRoleId: "mod-role",
      });

      const interaction = makeInteraction({ roleIds: ["mod-role"] });
      expect(await hasPermission(interaction, "mod")).toBe(true);
    });

    it("grants mod access when user has adminRoleId", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: "admin-role",
        modRoleId: "mod-role",
      });

      const interaction = makeInteraction({ roleIds: ["admin-role"] });
      expect(await hasPermission(interaction, "mod")).toBe(true);
    });

    it("falls back to ManageMessages when no roles configured", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: null,
        modRoleId: null,
      });

      const interaction = makeInteraction({
        permissions: [PermissionFlagsBits.ManageMessages],
      });
      expect(await hasPermission(interaction, "mod")).toBe(true);
    });

    it("denies mod access without role or permission", async () => {
      mocks.prisma.discordGuild.findFirst.mockResolvedValue({
        adminRoleId: null,
        modRoleId: "mod-role",
      });

      const interaction = makeInteraction({ roleIds: [], permissions: [] });
      expect(await hasPermission(interaction, "mod")).toBe(false);
    });
  });

  it("returns false when guildId is null", async () => {
    const interaction = makeInteraction({ guildId: null });
    expect(await hasPermission(interaction, "admin")).toBe(false);
  });

  it("caches guild config and reuses it", async () => {
    mocks.prisma.discordGuild.findFirst.mockResolvedValue({
      adminRoleId: "admin-role",
      modRoleId: null,
    });

    const interaction = makeInteraction({ roleIds: ["admin-role"] });
    await hasPermission(interaction, "admin");
    await hasPermission(interaction, "admin");

    expect(mocks.prisma.discordGuild.findFirst).toHaveBeenCalledTimes(1);
  });

  it("clearGuildRoleCache forces a refetch", async () => {
    mocks.prisma.discordGuild.findFirst.mockResolvedValue({
      adminRoleId: "admin-role",
      modRoleId: null,
    });

    const interaction = makeInteraction({ roleIds: ["admin-role"] });
    await hasPermission(interaction, "admin");

    clearGuildRoleCache("guild-1");
    await hasPermission(interaction, "admin");

    expect(mocks.prisma.discordGuild.findFirst).toHaveBeenCalledTimes(2);
  });
});
