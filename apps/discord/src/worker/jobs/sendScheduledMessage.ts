import type { Client, EmbedBuilder, TextChannel } from "discord.js";
import { CronExpressionParser } from "cron-parser";
import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";
import {
  replaceTemplateVariables,
  buildCustomEmbed,
} from "../../utils/embeds.js";

function getNextRun(cronExpression: string, after: Date): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression, { currentDate: after });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

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
      // Determine if this schedule should fire now
      if (schedule.nextRunAt && schedule.nextRunAt > now) {
        continue; // Not time yet
      }

      // If nextRunAt is null (first run), compute it from cron and seed it
      if (!schedule.nextRunAt) {
        const nextRun = getNextRun(schedule.cronExpression!, now);
        if (nextRun) {
          await prisma.discordScheduledMessage.update({
            where: { id: schedule.id },
            data: { nextRunAt: nextRun },
          });
        }
        continue;
      }

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

      // Compute next run time from cron
      const nextRun = getNextRun(schedule.cronExpression!, now);

      await prisma.discordScheduledMessage.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRun,
        },
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
