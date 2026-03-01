import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";
import {
  replaceTemplateVariables,
  buildCustomEmbed,
} from "../../utils/embeds.js";

export default async function sendScheduledMessage(
  client: Client
): Promise<void> {
  const now = new Date();

  const schedules = await prisma.discordScheduledMessage.findMany({
    where: {
      enabled: true,
      type: "RECURRING",
      cronExpression: { not: null },
    },
  });

  for (const schedule of schedules) {
    try {
      const guild = client.guilds.cache.get(schedule.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(schedule.channelId) as
        | TextChannel
        | undefined;
      if (!channel || !("send" in channel)) continue;

      const variables = {
        server: guild.name,
        memberCount: String(guild.memberCount),
      };

      let content: string | undefined;
      let embedJson: string | null | undefined;

      if (schedule.templateId) {
        const template = await prisma.discordMessageTemplate.findUnique({
          where: { id: schedule.templateId },
        });
        if (template) {
          content = template.content ?? undefined;
          embedJson = template.embedJson;
        }
      } else {
        content = schedule.content ?? undefined;
        embedJson = schedule.embedJson;
      }

      const sendOptions: {
        content?: string;
        embeds?: EmbedBuilder[];
      } = {};

      if (content) {
        sendOptions.content = replaceTemplateVariables(content, variables);
      }

      if (embedJson) {
        const embed = buildCustomEmbed(embedJson, variables);
        if (embed) {
          sendOptions.embeds = [embed];
        }
      }

      if (!sendOptions.content && !sendOptions.embeds) continue;

      await channel.send(sendOptions);

      await prisma.discordScheduledMessage.update({
        where: { id: schedule.id },
        data: { lastRunAt: now },
      });

      logger.success(
        "Scheduled Message",
        `Sent "${schedule.name}" to #${channel.name} in ${guild.name}`
      );
    } catch (error) {
      logger.error(
        "Scheduled Message",
        `Failed to send "${schedule.name}"`,
        error
      );
    }
  }
}
