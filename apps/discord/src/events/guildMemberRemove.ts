import { TextChannel } from "discord.js";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "@community-bot/db";
import logger from "../utils/logger.js";
import {
  replaceTemplateVariables,
  buildCustomEmbed,
} from "../utils/embeds.js";
import type { TemplateVariables } from "../utils/embeds.js";

function buildLeaveVariables(
  member: GuildMember | PartialGuildMember
): TemplateVariables {
  return {
    user: `<@${member.id}>`,
    username: member.user?.username ?? "Unknown",
    displayName: member.displayName ?? member.user?.username ?? "Unknown",
    server: member.guild.name,
    memberCount: member.guild.memberCount.toLocaleString(),
    tag: member.user?.tag ?? "Unknown",
  };
}

export async function guildMemberRemoveEvent(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  const guild = await prisma.discordGuild.findUnique({
    where: { guildId: member.guild.id },
  });

  if (!guild) return;
  if (!guild.leaveEnabled || !guild.leaveChannelId) return;

  const variables = buildLeaveVariables(member);

  try {
    const channel = await member.guild.channels.fetch(guild.leaveChannelId);
    if (channel instanceof TextChannel) {
      if (guild.leaveUseEmbed && guild.leaveEmbedJson) {
        const embed = buildCustomEmbed(guild.leaveEmbedJson, variables);
        if (embed) {
          await channel.send({ embeds: [embed] });
        }
      } else if (guild.leaveMessage) {
        await channel.send(replaceTemplateVariables(guild.leaveMessage, variables));
      }
    }
  } catch (err) {
    logger.error(
      "Discord - Event (GuildMemberRemove)",
      "Failed to send leave message",
      err,
      { guildId: member.guild.id }
    );
  }
}
