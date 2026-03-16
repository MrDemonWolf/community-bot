import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { db, eq, and, asc, discordScheduledMessages, discordMessageTemplates } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import { isValidCron, cronToText } from "../../utils/cronParser.js";
import { sendPaginatedEmbed } from "../../utils/pagination.js";

const BRAND_COLOR = 0x00aced;

export const scheduleCommand = new SlashCommandBuilder()
  .setName("schedule")
  .setDescription("Manage scheduled messages")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a scheduled message")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Schedule name").setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to send the message to")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("once or recurring")
          .setRequired(true)
          .addChoices(
            { name: "Once", value: "ONCE" },
            { name: "Recurring", value: "RECURRING" }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("content")
          .setDescription("Message content")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("cron")
          .setDescription("Cron expression (for recurring, e.g. '0 9 * * *')")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("template")
          .setDescription("Template name to use instead of content")
          .setRequired(false)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit a scheduled message")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Schedule name")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("content")
          .setDescription("New message content")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("cron")
          .setDescription("New cron expression")
          .setRequired(false)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("New target channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a scheduled message")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Schedule name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all scheduled messages")
  )
  .addSubcommand((sub) =>
    sub
      .setName("enable")
      .setDescription("Enable a scheduled message")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Schedule name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("disable")
      .setDescription("Disable a scheduled message")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Schedule name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  ) as SlashCommandBuilder;

export async function handleScheduleCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await hasPermission(interaction, "admin"))) {
    await interaction.reply({
      content:
        "You need the Admin role or Manage Server permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "create":
      return handleCreate(interaction, guildId);
    case "edit":
      return handleEdit(interaction, guildId);
    case "delete":
      return handleDelete(interaction, guildId);
    case "list":
      return handleList(interaction, guildId);
    case "enable":
      return handleToggle(interaction, guildId, true);
    case "disable":
      return handleToggle(interaction, guildId, false);
  }
}

async function handleCreate(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();
    const channel = interaction.options.getChannel("channel", true);
    const type = interaction.options.getString("type", true) as
      | "ONCE"
      | "RECURRING";
    const content = interaction.options.getString("content");
    const cron = interaction.options.getString("cron");
    const templateName = interaction.options.getString("template");

    if (!content && !templateName) {
      await interaction.editReply({
        content: "Provide either message content or a template.",
      });
      return;
    }

    if (type === "RECURRING" && !cron) {
      await interaction.editReply({
        content: "Recurring schedules require a cron expression.",
      });
      return;
    }

    if (cron && !isValidCron(cron)) {
      await interaction.editReply({
        content: "Invalid cron expression. Example: `0 9 * * *` (daily at 9 AM).",
      });
      return;
    }

    const existing = await db.query.discordScheduledMessages.findFirst({
      where: and(eq(discordScheduledMessages.guildId, guildId), eq(discordScheduledMessages.name, name)),
    });

    if (existing) {
      await interaction.editReply({
        content: `A schedule named **${name}** already exists.`,
      });
      return;
    }

    let templateId: string | undefined;
    if (templateName) {
      const template = await db.query.discordMessageTemplates.findFirst({
        where: and(eq(discordMessageTemplates.guildId, guildId), eq(discordMessageTemplates.name, templateName.toLowerCase())),
      });
      if (!template) {
        await interaction.editReply({
          content: `Template **${templateName}** not found.`,
        });
        return;
      }
      templateId = template.id;
    }

    await db.insert(discordScheduledMessages).values({
        guildId,
        name,
        channelId: channel.id,
        type,
        cronExpression: cron,
        content: templateId ? undefined : content,
        templateId,
        createdBy: interaction.user.id,
      });

    const scheduleDesc = cron ? cronToText(cron) : "One-time (manual trigger)";

    await interaction.editReply({
      content: `Schedule **${name}** created. Type: ${type}. Schedule: ${scheduleDesc}. Channel: <#${channel.id}>.`,
    });
    logger.commands.success("schedule create", username, userId, guildId);
  } catch (error) {
    logger.commands.error("schedule create", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while creating the schedule.",
    });
  }
}

async function handleEdit(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();
    const content = interaction.options.getString("content");
    const cron = interaction.options.getString("cron");
    const channel = interaction.options.getChannel("channel");

    if (!content && !cron && !channel) {
      await interaction.editReply({
        content: "You must provide at least one field to update.",
      });
      return;
    }

    if (cron && !isValidCron(cron)) {
      await interaction.editReply({
        content: "Invalid cron expression.",
      });
      return;
    }

    const schedule = await db.query.discordScheduledMessages.findFirst({
      where: and(eq(discordScheduledMessages.guildId, guildId), eq(discordScheduledMessages.name, name)),
    });

    if (!schedule) {
      await interaction.editReply({
        content: `Schedule **${name}** not found.`,
      });
      return;
    }

    await db.update(discordScheduledMessages).set({
        ...(content !== null && { content }),
        ...(cron !== null && { cronExpression: cron }),
        ...(channel && { channelId: channel.id }),
      }).where(eq(discordScheduledMessages.id, schedule.id));

    await interaction.editReply({
      content: `Schedule **${name}** updated.`,
    });
    logger.commands.success("schedule edit", username, userId, guildId);
  } catch (error) {
    logger.commands.error("schedule edit", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while editing the schedule.",
    });
  }
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();

    const deleted = await db.delete(discordScheduledMessages).where(and(eq(discordScheduledMessages.guildId, guildId), eq(discordScheduledMessages.name, name))).returning();

    if (deleted.length === 0) {
      await interaction.editReply({
        content: `Schedule **${name}** not found.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Schedule **${name}** deleted.`,
    });
    logger.commands.success("schedule delete", username, userId, guildId);
  } catch (error) {
    logger.commands.error("schedule delete", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while deleting the schedule.",
    });
  }
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const schedules = await db.query.discordScheduledMessages.findMany({
      where: eq(discordScheduledMessages.guildId, guildId),
      orderBy: asc(discordScheduledMessages.name),
    });

    if (schedules.length === 0) {
      await interaction.editReply({
        content: "No scheduled messages found. Use `/schedule create` to add one.",
      });
      return;
    }

    const perPage = 8;
    const pages: EmbedBuilder[] = [];

    for (let i = 0; i < schedules.length; i += perPage) {
      const chunk = schedules.slice(i, i + perPage);
      const embed = new EmbedBuilder()
        .setTitle("Scheduled Messages")
        .setColor(BRAND_COLOR)
        .addFields(
          chunk.map((s) => {
            const status = s.enabled ? "Enabled" : "Disabled";
            const schedule = s.cronExpression
              ? cronToText(s.cronExpression)
              : "One-time";
            return {
              name: `${s.name} (${status})`,
              value: `Type: ${s.type} | Schedule: ${schedule} | Channel: <#${s.channelId}>`,
            };
          })
        )
        .setFooter({
          text: `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} total`,
        });

      pages.push(embed);
    }

    await sendPaginatedEmbed({ interaction, pages });
    logger.commands.success("schedule list", username, userId, guildId);
  } catch (error) {
    logger.commands.error("schedule list", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while listing schedules.",
    });
  }
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  enabled: boolean
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const action = enabled ? "enable" : "disable";

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();

    const schedule = await db.query.discordScheduledMessages.findFirst({
      where: and(eq(discordScheduledMessages.guildId, guildId), eq(discordScheduledMessages.name, name)),
    });

    if (!schedule) {
      await interaction.editReply({
        content: `Schedule **${name}** not found.`,
      });
      return;
    }

    await db.update(discordScheduledMessages).set({ enabled }).where(eq(discordScheduledMessages.id, schedule.id));

    await interaction.editReply({
      content: `Schedule **${name}** ${enabled ? "enabled" : "disabled"}.`,
    });
    logger.commands.success(`schedule ${action}`, username, userId, guildId);
  } catch (error) {
    logger.commands.error(`schedule ${action}`, username, userId, error, guildId);
    await interaction.editReply({
      content: `An error occurred while ${action === "enable" ? "enabling" : "disabling"} the schedule.`,
    });
  }
}
