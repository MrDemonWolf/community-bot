import { TextChannel } from "discord.js";
import type { GuildMember } from "discord.js";
import { prisma } from "@community-bot/db";
import logger from "../utils/logger.js";
import {
  replaceTemplateVariables,
  buildCustomEmbed,
} from "../utils/embeds.js";
import type { TemplateVariables } from "../utils/embeds.js";

function buildWelcomeVariables(member: GuildMember): TemplateVariables {
  return {
    user: `<@${member.id}>`,
    username: member.user.username,
    displayName: member.displayName,
    server: member.guild.name,
    memberCount: member.guild.memberCount.toLocaleString(),
    tag: member.user.tag,
  };
}

export async function guildMemberAddEvent(member: GuildMember): Promise<void> {
  const guild = await prisma.discordGuild.findUnique({
    where: { guildId: member.guild.id },
  });

  if (!guild) return;

  const variables = buildWelcomeVariables(member);

  // 1. Channel welcome message
  if (guild.welcomeEnabled && guild.welcomeChannelId) {
    try {
      const channel = await member.guild.channels.fetch(guild.welcomeChannelId);
      if (channel instanceof TextChannel) {
        if (guild.welcomeUseEmbed && guild.welcomeEmbedJson) {
          const embed = buildCustomEmbed(guild.welcomeEmbedJson, variables);
          if (embed) {
            await channel.send({ embeds: [embed] });
          }
        } else if (guild.welcomeMessage) {
          await channel.send(replaceTemplateVariables(guild.welcomeMessage, variables));
        }
      }
    } catch (err) {
      logger.error(
        "Discord - Event (GuildMemberAdd)",
        "Failed to send welcome message",
        err,
        { guildId: member.guild.id }
      );
    }
  }

  // 2. DM welcome
  if (guild.dmWelcomeEnabled) {
    try {
      if (guild.dmWelcomeUseEmbed && guild.dmWelcomeEmbedJson) {
        const embed = buildCustomEmbed(guild.dmWelcomeEmbedJson, variables);
        if (embed) {
          await member.send({ embeds: [embed] });
        }
      } else if (guild.dmWelcomeMessage) {
        await member.send(replaceTemplateVariables(guild.dmWelcomeMessage, variables));
      }
    } catch (err) {
      logger.error(
        "Discord - Event (GuildMemberAdd)",
        "Failed to send DM welcome (user may have DMs disabled)",
        err,
        { guildId: member.guild.id, userId: member.id }
      );
    }
  }

  // 3. Auto-role
  if (guild.autoRoleEnabled && guild.autoRoleId) {
    try {
      await member.roles.add(guild.autoRoleId);
    } catch (err) {
      logger.error(
        "Discord - Event (GuildMemberAdd)",
        "Failed to assign auto-role",
        err,
        { guildId: member.guild.id, roleId: guild.autoRoleId }
      );
    }
  }
}
