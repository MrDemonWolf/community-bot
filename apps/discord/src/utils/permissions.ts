import { PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "@community-bot/db";

interface GuildRoleConfig {
  adminRoleId: string | null;
  modRoleId: string | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const roleCache = new Map<string, GuildRoleConfig>();

async function getGuildRoleConfig(guildId: string): Promise<GuildRoleConfig> {
  const cached = roleCache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const guild = await prisma.discordGuild.findFirst({
    where: { guildId },
    select: { adminRoleId: true, modRoleId: true },
  });

  const config: GuildRoleConfig = {
    adminRoleId: guild?.adminRoleId ?? null,
    modRoleId: guild?.modRoleId ?? null,
    fetchedAt: Date.now(),
  };

  roleCache.set(guildId, config);
  return config;
}

export function clearGuildRoleCache(guildId: string): void {
  roleCache.delete(guildId);
}

/**
 * Check if the interaction member has the required permission level.
 *
 * - "admin": checks adminRoleId membership, falls back to ManageGuild permission
 * - "mod": checks modRoleId OR adminRoleId membership, falls back to ManageMessages permission
 */
export async function hasPermission(
  interaction: ChatInputCommandInteraction,
  level: "admin" | "mod"
): Promise<boolean> {
  const guildId = interaction.guildId;
  if (!guildId) return false;

  const member = interaction.member;
  if (!member || !("roles" in member)) return false;

  const config = await getGuildRoleConfig(guildId);
  const memberRoles =
    "cache" in member.roles
      ? member.roles.cache
      : null;

  if (level === "admin") {
    if (config.adminRoleId && memberRoles?.has(config.adminRoleId)) {
      return true;
    }
    // Fallback to Discord ManageGuild permission
    if (
      "permissions" in member &&
      typeof member.permissions === "object" &&
      member.permissions !== null &&
      "has" in member.permissions
    ) {
      return member.permissions.has(PermissionFlagsBits.ManageGuild);
    }
    return false;
  }

  // level === "mod"
  if (config.modRoleId && memberRoles?.has(config.modRoleId)) {
    return true;
  }
  if (config.adminRoleId && memberRoles?.has(config.adminRoleId)) {
    return true;
  }
  // Fallback to Discord ManageMessages permission
  if (
    "permissions" in member &&
    typeof member.permissions === "object" &&
    member.permissions !== null &&
    "has" in member.permissions
  ) {
    return member.permissions.has(PermissionFlagsBits.ManageMessages);
  }
  return false;
}
