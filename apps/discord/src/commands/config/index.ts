import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { db, eq, and, asc, discordLogConfigs, discordWarnThresholds } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";

const BRAND_COLOR = 0x00aced;

export const configCommand = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configure server settings")
  .addSubcommandGroup((group) =>
    group
      .setName("log")
      .setDescription("Configure logging channels")
      .addSubcommand((sub) =>
        sub
          .setName("set-moderation")
          .setDescription("Set the moderation log channel")
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Channel for moderation logs")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("set-server")
          .setDescription("Set the server event log channel")
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Channel for server event logs")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("set-voice")
          .setDescription("Set the voice activity log channel")
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Channel for voice activity logs")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("view").setDescription("View current log channel configuration")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("thresholds")
      .setDescription("Configure warning escalation thresholds")
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Set an escalation action at a warning count")
          .addIntegerOption((opt) =>
            opt
              .setName("count")
              .setDescription("Number of warnings to trigger action")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(50)
          )
          .addStringOption((opt) =>
            opt
              .setName("action")
              .setDescription("Action to take")
              .setRequired(true)
              .addChoices(
                { name: "Ban", value: "BAN" },
                { name: "Kick", value: "KICK" },
                { name: "Mute", value: "MUTE" }
              )
          )
          .addIntegerOption((opt) =>
            opt
              .setName("duration")
              .setDescription("Duration in minutes (required for Mute)")
              .setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("clear")
          .setDescription("Remove a warning threshold")
          .addIntegerOption((opt) =>
            opt
              .setName("count")
              .setDescription("Warning count to remove")
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List all configured warning thresholds")
      )
  ) as SlashCommandBuilder;

export async function handleConfigCommand(
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

  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  logger.debug(
    "Config Command",
    `Routing: ${subcommandGroup ?? ""}/${subcommand}`
  );

  if (subcommandGroup === "log") {
    switch (subcommand) {
      case "set-moderation":
        return handleSetLogChannel(interaction, "moderationChannelId");
      case "set-server":
        return handleSetLogChannel(interaction, "serverChannelId");
      case "set-voice":
        return handleSetLogChannel(interaction, "voiceChannelId");
      case "view":
        return handleViewLogConfig(interaction);
    }
  }

  if (subcommandGroup === "thresholds") {
    switch (subcommand) {
      case "set":
        return handleSetThreshold(interaction);
      case "clear":
        return handleClearThreshold(interaction);
      case "list":
        return handleListThresholds(interaction);
    }
  }
}

async function handleSetLogChannel(
  interaction: ChatInputCommandInteraction,
  field: "moderationChannelId" | "serverChannelId" | "voiceChannelId"
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel("channel", true);

    await db.insert(discordLogConfigs).values({ guildId, [field]: channel.id }).onConflictDoUpdate({ target: discordLogConfigs.guildId, set: { [field]: channel.id } });

    const labelMap: Record<string, string> = {
      moderationChannelId: "Moderation",
      serverChannelId: "Server",
      voiceChannelId: "Voice",
    };

    await interaction.editReply({
      content: `${labelMap[field]} log channel set to <#${channel.id}>.`,
    });
    logger.commands.success("config", username, userId, guildId);
  } catch (error) {
    logger.commands.error("config", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while updating the log channel.",
    });
  }
}

async function handleViewLogConfig(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await db.query.discordLogConfigs.findFirst({
      where: eq(discordLogConfigs.guildId, guildId),
    });

    const fmt = (id: string | null | undefined) =>
      id ? `<#${id}>` : "Not configured";

    const embed = new EmbedBuilder()
      .setTitle("Log Channel Configuration")
      .addFields(
        {
          name: "Moderation Logs",
          value: fmt(config?.moderationChannelId),
          inline: true,
        },
        {
          name: "Server Logs",
          value: fmt(config?.serverChannelId),
          inline: true,
        },
        {
          name: "Voice Logs",
          value: fmt(config?.voiceChannelId),
          inline: true,
        }
      )
      .setColor(BRAND_COLOR)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.commands.success("config", username, userId, guildId);
  } catch (error) {
    logger.commands.error("config", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while fetching log configuration.",
    });
  }
}

async function handleSetThreshold(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const count = interaction.options.getInteger("count", true);
    const action = interaction.options.getString("action", true) as
      | "BAN"
      | "KICK"
      | "MUTE";
    const duration = interaction.options.getInteger("duration");

    if (action === "MUTE" && !duration) {
      await interaction.editReply({
        content: "Duration is required for Mute action.",
      });
      return;
    }

    await db.insert(discordWarnThresholds).values({
        guildId,
        count,
        action,
        duration: action === "MUTE" ? duration : null,
      }).onConflictDoUpdate({ target: [discordWarnThresholds.guildId, discordWarnThresholds.count], set: {
        action,
        duration: action === "MUTE" ? duration : null,
      } });

    const actionLabel =
      action === "MUTE" ? `Mute (${duration}m)` : action === "BAN" ? "Ban" : "Kick";

    await interaction.editReply({
      content: `Threshold set: at **${count}** warnings → **${actionLabel}**`,
    });
    logger.commands.success("config thresholds set", username, userId, guildId);
  } catch (error) {
    logger.commands.error("config", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while setting the threshold.",
    });
  }
}

async function handleClearThreshold(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const count = interaction.options.getInteger("count", true);

    const deleted = await db.delete(discordWarnThresholds).where(and(eq(discordWarnThresholds.guildId, guildId), eq(discordWarnThresholds.count, count))).returning();

    if (deleted.length === 0) {
      await interaction.editReply({
        content: `No threshold configured for ${count} warnings.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Threshold at **${count}** warnings removed.`,
    });
    logger.commands.success("config thresholds clear", username, userId, guildId);
  } catch (error) {
    logger.commands.error("config", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while clearing the threshold.",
    });
  }
}

async function handleListThresholds(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const thresholds = await db.query.discordWarnThresholds.findMany({
      where: eq(discordWarnThresholds.guildId, guildId),
      orderBy: asc(discordWarnThresholds.count),
    });

    if (thresholds.length === 0) {
      await interaction.editReply({
        content:
          "No warning thresholds configured. Use `/config thresholds set` to add one.",
      });
      return;
    }

    const lines = thresholds.map((t) => {
      const actionLabel =
        t.action === "MUTE"
          ? `Mute (${t.duration}m)`
          : t.action === "BAN"
            ? "Ban"
            : "Kick";
      return `**${t.count}** warnings → **${actionLabel}**`;
    });

    const embed = new EmbedBuilder()
      .setTitle("Warning Escalation Thresholds")
      .setDescription(lines.join("\n"))
      .setColor(BRAND_COLOR)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.commands.success("config thresholds list", username, userId, guildId);
  } catch (error) {
    logger.commands.error("config", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while listing thresholds.",
    });
  }
}
