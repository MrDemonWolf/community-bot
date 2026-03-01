import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
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

    await prisma.discordLogConfig.upsert({
      where: { guildId },
      create: { guildId, [field]: channel.id },
      update: { [field]: channel.id },
    });

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

    const config = await prisma.discordLogConfig.findUnique({
      where: { guildId },
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
