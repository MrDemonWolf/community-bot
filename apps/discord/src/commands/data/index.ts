import {
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";

export const dataCommand = new SlashCommandBuilder()
  .setName("data")
  .setDescription("Manage your personal data")
  .addSubcommand((sub) =>
    sub
      .setName("export")
      .setDescription("Export all data the bot has about you in this server")
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription(
        "Request deletion of your data from this server (cases excluded)"
      )
  ) as SlashCommandBuilder;

export async function handleDataCommand(
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
      case "export":
        return await handleExport(interaction);
      case "delete":
        return await handleDeleteData(interaction);
    }
  } catch (error) {
    logger.commands.error("data", username, userId, error, guildId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "An error occurred while processing your data request.",
      });
    } else {
      await interaction.reply({
        content: "An error occurred while processing your data request.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleExport(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Gather all data related to this user in this guild
  const [cases, reports, warnings] = await Promise.all([
    prisma.discordCase.findMany({
      where: { guildId, targetId: userId },
      orderBy: { caseNumber: "asc" },
      include: { notes: true },
    }),
    prisma.discordReport.findMany({
      where: {
        guildId,
        OR: [{ reporterId: userId }, { targetId: userId }],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.discordCase.count({
      where: { guildId, targetId: userId, type: "WARN", resolved: false },
    }),
  ]);

  const data = {
    userId,
    guildId,
    exportedAt: new Date().toISOString(),
    moderationCases: cases.map((c) => ({
      caseNumber: c.caseNumber,
      type: c.type,
      reason: c.reason,
      moderator: c.moderatorTag,
      duration: c.duration,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
      notes: c.notes.map((n) => ({
        author: n.authorTag,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
      })),
    })),
    reports: reports.map((r) => ({
      role: r.reporterId === userId ? "reporter" : "target",
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    activeWarnings: warnings,
  };

  const json = JSON.stringify(data, null, 2);

  // Send as a file attachment
  const buffer = Buffer.from(json, "utf-8");

  await interaction.editReply({
    content: "Here is your data export:",
    files: [
      {
        attachment: buffer,
        name: `data-export-${userId}-${guildId}.json`,
      },
    ],
  });

  logger.commands.success("data export", interaction.user.username, interaction.user.id, guildId);
}

async function handleDeleteData(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Delete user-submitted reports (where they are the reporter)
  const deletedReports = await prisma.discordReport.deleteMany({
    where: { guildId, reporterId: userId },
  });

  // Note: We do NOT delete moderation cases as they are moderation records.
  // We also don't delete reports where the user is the target (mod records).

  await interaction.editReply({
    content: [
      "Data deletion processed:",
      `- ${deletedReports.count} report(s) you submitted have been deleted.`,
      "",
      "**Note:** Moderation cases (bans, warns, etc.) are retained as server moderation records and are not subject to self-service deletion. Contact a server administrator for questions.",
    ].join("\n"),
  });

  logger.commands.success("data delete", interaction.user.username, interaction.user.id, guildId);
}
