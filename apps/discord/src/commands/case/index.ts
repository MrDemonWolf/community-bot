import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { db, eq, and, ilike, desc, asc, discordCases, discordCaseNotes } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import { sendPaginatedEmbed } from "../../utils/pagination.js";

const BRAND_COLOR = 0x00aced;
const CASES_PER_PAGE = 10;

const TYPE_EMOJI: Record<string, string> = {
  BAN: "🔨",
  TEMPBAN: "⏱️",
  KICK: "👢",
  WARN: "⚠️",
  MUTE: "🔇",
  UNBAN: "✅",
  UNWARN: "✅",
  UNMUTE: "✅",
  NOTE: "📝",
};

export const caseCommand = new SlashCommandBuilder()
  .setName("case")
  .setDescription("Manage moderation cases")
  .addSubcommand((sub) =>
    sub
      .setName("lookup")
      .setDescription("Look up a specific case by number")
      .addIntegerOption((opt) =>
        opt
          .setName("number")
          .setDescription("The case number")
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List recent cases")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Filter by user")
      )
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Filter by case type")
          .addChoices(
            { name: "Ban", value: "BAN" },
            { name: "Tempban", value: "TEMPBAN" },
            { name: "Kick", value: "KICK" },
            { name: "Warn", value: "WARN" },
            { name: "Mute", value: "MUTE" },
            { name: "Unban", value: "UNBAN" },
            { name: "Unwarn", value: "UNWARN" },
            { name: "Unmute", value: "UNMUTE" },
            { name: "Note", value: "NOTE" }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("note")
      .setDescription("Add a note to a case")
      .addIntegerOption((opt) =>
        opt
          .setName("number")
          .setDescription("The case number")
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((opt) =>
        opt
          .setName("content")
          .setDescription("Note content")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("search")
      .setDescription("Search cases by reason text")
      .addStringOption((opt) =>
        opt
          .setName("query")
          .setDescription("Search query")
          .setRequired(true)
      )
  ) as SlashCommandBuilder;

export async function handleCaseCommand(
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

  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content:
        "You need the Mod role or Manage Messages permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "lookup":
        return await handleLookup(interaction);
      case "list":
        return await handleList(interaction);
      case "note":
        return await handleNote(interaction);
      case "search":
        return await handleSearch(interaction);
    }
  } catch (error) {
    logger.commands.error("case", username, userId, error, guildId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "An error occurred while executing the case command.",
      });
    } else {
      await interaction.reply({
        content: "An error occurred while executing the case command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleLookup(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const caseNumber = interaction.options.getInteger("number", true);

  const modCase = await db.query.discordCases.findFirst({
    where: and(eq(discordCases.guildId, guildId), eq(discordCases.caseNumber, caseNumber)),
    with: { notes: { orderBy: asc(discordCaseNotes.createdAt) } },
  });

  if (!modCase) {
    await interaction.editReply({ content: `Case #${caseNumber} not found.` });
    return;
  }

  const emoji = TYPE_EMOJI[modCase.type] ?? "";
  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Case #${modCase.caseNumber} — ${modCase.type}`)
    .setColor(modCase.resolved ? 0x2ecc71 : BRAND_COLOR)
    .addFields(
      { name: "Target", value: `${modCase.targetTag} (<@${modCase.targetId}>)`, inline: true },
      { name: "Moderator", value: `${modCase.moderatorTag} (<@${modCase.moderatorId}>)`, inline: true },
      { name: "Status", value: modCase.resolved ? "Resolved" : "Active", inline: true },
      { name: "Reason", value: modCase.reason ?? "No reason provided" }
    )
    .setTimestamp(modCase.createdAt);

  if (modCase.duration) {
    embed.addFields({
      name: "Duration",
      value: `${modCase.duration} minutes`,
      inline: true,
    });
  }

  if (modCase.expiresAt) {
    embed.addFields({
      name: "Expires",
      value: `<t:${Math.floor(modCase.expiresAt.getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  if (modCase.resolved && modCase.resolvedBy) {
    embed.addFields({
      name: "Resolved By",
      value: `<@${modCase.resolvedBy}>`,
      inline: true,
    });
  }

  if (modCase.notes.length > 0) {
    const noteText = modCase.notes
      .map(
        (n) =>
          `**${n.authorTag}** (<t:${Math.floor(n.createdAt.getTime() / 1000)}:R>): ${n.content}`
      )
      .join("\n");
    embed.addFields({
      name: `Notes (${modCase.notes.length})`,
      value: noteText.slice(0, 1024),
    });
  }

  await interaction.editReply({ embeds: [embed] });
  logger.commands.success("case lookup", interaction.user.username, interaction.user.id, guildId);
}

async function handleList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const targetUser = interaction.options.getUser("user");
  const type = interaction.options.getString("type");

  const conditions = [eq(discordCases.guildId, guildId)];
  if (targetUser) conditions.push(eq(discordCases.targetId, targetUser.id));
  if (type) conditions.push(eq(discordCases.type, type as any));

  const cases = await db.query.discordCases.findMany({
    where: and(...conditions),
    orderBy: desc(discordCases.caseNumber),
    limit: 100,
  });

  if (cases.length === 0) {
    await interaction.editReply({ content: "No cases found." });
    return;
  }

  const pages: EmbedBuilder[] = [];
  for (let i = 0; i < cases.length; i += CASES_PER_PAGE) {
    const chunk = cases.slice(i, i + CASES_PER_PAGE);
    const description = chunk
      .map((c) => {
        const emoji = TYPE_EMOJI[c.type] ?? "";
        const status = c.resolved ? "~~" : "";
        return `${status}**#${c.caseNumber}** ${emoji} ${c.type} — ${c.targetTag}${status}\n${c.reason?.slice(0, 60) ?? "No reason"} • <t:${Math.floor(c.createdAt.getTime() / 1000)}:R>`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("Moderation Cases")
      .setDescription(description)
      .setColor(BRAND_COLOR)
      .setFooter({
        text: `${cases.length} total cases${targetUser ? ` for ${targetUser.tag}` : ""}${type ? ` (${type})` : ""}`,
      });

    pages.push(embed);
  }

  await sendPaginatedEmbed({ interaction, pages });
  logger.commands.success("case list", interaction.user.username, interaction.user.id, guildId);
}

async function handleNote(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const caseNumber = interaction.options.getInteger("number", true);
  const content = interaction.options.getString("content", true);

  const modCase = await db.query.discordCases.findFirst({
    where: and(eq(discordCases.guildId, guildId), eq(discordCases.caseNumber, caseNumber)),
  });

  if (!modCase) {
    await interaction.editReply({ content: `Case #${caseNumber} not found.` });
    return;
  }

  await db.insert(discordCaseNotes).values({
      caseId: modCase.id,
      authorId: interaction.user.id,
      authorTag: interaction.user.tag,
      content,
    });

  await interaction.editReply({
    content: `Note added to case #${caseNumber}.`,
  });
  logger.commands.success("case note", interaction.user.username, interaction.user.id, guildId);
}

async function handleSearch(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const query = interaction.options.getString("query", true);

  const cases = await db.query.discordCases.findMany({
    where: and(eq(discordCases.guildId, guildId), ilike(discordCases.reason, `%${query}%`)),
    orderBy: desc(discordCases.caseNumber),
    limit: 50,
  });

  if (cases.length === 0) {
    await interaction.editReply({
      content: `No cases found matching "${query}".`,
    });
    return;
  }

  const pages: EmbedBuilder[] = [];
  for (let i = 0; i < cases.length; i += CASES_PER_PAGE) {
    const chunk = cases.slice(i, i + CASES_PER_PAGE);
    const description = chunk
      .map((c) => {
        const emoji = TYPE_EMOJI[c.type] ?? "";
        return `**#${c.caseNumber}** ${emoji} ${c.type} — ${c.targetTag}\n${c.reason?.slice(0, 80) ?? "No reason"} • <t:${Math.floor(c.createdAt.getTime() / 1000)}:R>`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(`Search: "${query}"`)
      .setDescription(description)
      .setColor(BRAND_COLOR)
      .setFooter({ text: `${cases.length} results` });

    pages.push(embed);
  }

  await sendPaginatedEmbed({ interaction, pages });
  logger.commands.success("case search", interaction.user.username, interaction.user.id, guildId);
}
