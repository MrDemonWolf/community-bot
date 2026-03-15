import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { db, eq, and, asc, desc, discordReports } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import { dispatchLog } from "../../utils/eventLogger.js";
import { sendPaginatedEmbed } from "../../utils/pagination.js";

const BRAND_COLOR = 0x00aced;
const COLOR_REPORT = 0xe74c3c;
const COLOR_RESOLVE = 0x2ecc71;
const REPORTS_PER_PAGE = 8;

const STATUS_LABEL: Record<string, string> = {
  OPEN: "🔴 Open",
  INVESTIGATING: "🟡 Investigating",
  RESOLVED: "🟢 Resolved",
  DISMISSED: "⚪ Dismissed",
};

export const reportCommand = new SlashCommandBuilder()
  .setName("report")
  .setDescription("Report a user or manage reports")
  .addSubcommand((sub) =>
    sub
      .setName("user")
      .setDescription("Report a user to the moderators")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to report").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for the report")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Update report status (mod only)")
      .addIntegerOption((opt) =>
        opt
          .setName("id")
          .setDescription("Report number")
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("New status")
          .setRequired(true)
          .addChoices(
            { name: "Investigating", value: "INVESTIGATING" },
            { name: "Resolved", value: "RESOLVED" },
            { name: "Dismissed", value: "DISMISSED" }
          )
      )
      .addStringOption((opt) =>
        opt.setName("resolution").setDescription("Resolution notes")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List reports (mod only)")
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("Filter by status")
          .addChoices(
            { name: "Open", value: "OPEN" },
            { name: "Investigating", value: "INVESTIGATING" },
            { name: "Resolved", value: "RESOLVED" },
            { name: "Dismissed", value: "DISMISSED" }
          )
      )
      .addUserOption((opt) =>
        opt.setName("target").setDescription("Filter by reported user")
      )
  ) as SlashCommandBuilder;

export async function handleReportCommand(
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

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "user":
        return await handleReportUser(interaction);
      case "status":
        return await handleReportStatus(interaction);
      case "list":
        return await handleReportList(interaction);
    }
  } catch (error) {
    logger.commands.error("report", username, userId, error, guildId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "An error occurred while processing the report command.",
      });
    } else {
      await interaction.reply({
        content: "An error occurred while processing the report command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleReportUser(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);

  if (target.id === interaction.user.id) {
    await interaction.editReply({
      content: "You cannot report yourself.",
    });
    return;
  }

  if (target.bot) {
    await interaction.editReply({
      content: "You cannot report bots.",
    });
    return;
  }

  const [report] = await db.insert(discordReports).values({
      guildId,
      reporterId: interaction.user.id,
      reporterTag: interaction.user.tag,
      targetId: target.id,
      targetTag: target.tag,
      reason,
    }).returning();

  // Notify mod log channel
  const embed = new EmbedBuilder()
    .setTitle("New User Report")
    .setColor(COLOR_REPORT)
    .addFields(
      { name: "Reported User", value: `${target.tag} (<@${target.id}>)`, inline: true },
      { name: "Reporter", value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
      { name: "Reason", value: reason },
    )
    .setFooter({ text: `Report ID: ${report.id.slice(0, 8)}` })
    .setTimestamp();

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content:
      "Your report has been submitted. The moderation team will review it.",
  });
  logger.commands.success("report user", interaction.user.username, interaction.user.id, guildId);
}

async function handleReportStatus(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content: "You need the Mod role to manage reports.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;

  // Use the report's position in the list as a "number"
  const reportIndex = interaction.options.getInteger("id", true);
  const newStatus = interaction.options.getString("status", true) as
    | "INVESTIGATING"
    | "RESOLVED"
    | "DISMISSED";
  const resolution = interaction.options.getString("resolution");

  // Get the nth report (ordered by creation)
  const reports = await db.query.discordReports.findMany({
    where: eq(discordReports.guildId, guildId),
    orderBy: asc(discordReports.createdAt),
    offset: reportIndex - 1,
    limit: 1,
  });

  const report = reports[0];
  if (!report) {
    await interaction.editReply({
      content: `Report #${reportIndex} not found.`,
    });
    return;
  }

  const isResolving = newStatus === "RESOLVED" || newStatus === "DISMISSED";

  await db.update(discordReports).set({
      status: newStatus,
      ...(isResolving
        ? {
            resolvedBy: interaction.user.id,
            resolvedAt: new Date(),
            resolution: resolution ?? undefined,
          }
        : {}),
    }).where(eq(discordReports.id, report.id));

  const embed = new EmbedBuilder()
    .setTitle("Report Updated")
    .setColor(COLOR_RESOLVE)
    .addFields(
      { name: "Target", value: report.targetTag, inline: true },
      { name: "New Status", value: STATUS_LABEL[newStatus] ?? newStatus, inline: true },
      { name: "Updated By", value: interaction.user.tag, inline: true },
    )
    .setTimestamp();

  if (resolution) {
    embed.addFields({ name: "Resolution", value: resolution });
  }

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `Report #${reportIndex} status updated to **${newStatus}**.`,
  });
  logger.commands.success("report status", interaction.user.username, interaction.user.id, guildId);
}

async function handleReportList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content: "You need the Mod role to view reports.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const status = interaction.options.getString("status");
  const target = interaction.options.getUser("target");

  const conditions = [eq(discordReports.guildId, guildId)];
  if (status) conditions.push(eq(discordReports.status, status as any));
  if (target) conditions.push(eq(discordReports.targetId, target.id));

  const reports = await db.query.discordReports.findMany({
    where: and(...conditions),
    orderBy: desc(discordReports.createdAt),
    limit: 50,
  });

  if (reports.length === 0) {
    await interaction.editReply({ content: "No reports found." });
    return;
  }

  const pages: EmbedBuilder[] = [];
  for (let i = 0; i < reports.length; i += REPORTS_PER_PAGE) {
    const chunk = reports.slice(i, i + REPORTS_PER_PAGE);
    const description = chunk
      .map((r, idx) => {
        const num = i + idx + 1;
        const statusIcon = STATUS_LABEL[r.status] ?? r.status;
        return `**#${num}** ${statusIcon}\n**Target:** ${r.targetTag} • **Reporter:** ${r.reporterTag}\n${r.reason.slice(0, 80)} • <t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("User Reports")
      .setDescription(description)
      .setColor(BRAND_COLOR)
      .setFooter({
        text: `${reports.length} reports${status ? ` (${status})` : ""}`,
      });

    pages.push(embed);
  }

  await sendPaginatedEmbed({ interaction, pages });
  logger.commands.success("report list", interaction.user.username, interaction.user.id, guildId);
}
