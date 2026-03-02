import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import {
  buildCustomEmbed,
  replaceTemplateVariables,
} from "../../utils/embeds.js";

const BRAND_COLOR = 0x00aced;
const COMMANDS_PER_PAGE = 10;

export const customCommandCommand = new SlashCommandBuilder()
  .setName("cc")
  .setDescription("Custom commands")
  .addSubcommand((sub) =>
    sub
      .setName("run")
      .setDescription("Run a custom command")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Command name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a custom command")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Command name (lowercase, no spaces)")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("response")
          .setDescription("Text response (supports {user}, {server}, {channel} variables)")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Command description")
      )
      .addBooleanOption((opt) =>
        opt
          .setName("ephemeral")
          .setDescription("Only visible to the user who runs it")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit a custom command")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Command name")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("response")
          .setDescription("New text response")
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("New description")
      )
      .addBooleanOption((opt) =>
        opt
          .setName("ephemeral")
          .setDescription("Only visible to the user who runs it")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a custom command")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Command name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all custom commands")
  )
  .addSubcommand((sub) =>
    sub
      .setName("toggle")
      .setDescription("Enable or disable a custom command")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Command name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  ) as SlashCommandBuilder;

function getVariables(interaction: ChatInputCommandInteraction) {
  return {
    user: interaction.user.username,
    usermention: `<@${interaction.user.id}>`,
    userid: interaction.user.id,
    server: interaction.guild?.name ?? "Server",
    channel: interaction.channel
      ? `<#${interaction.channel.id}>`
      : "#unknown",
    membercount: interaction.guild?.memberCount?.toString() ?? "0",
  };
}

export async function handleCustomCommandCommand(
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
      case "run":
        return await handleRun(interaction);
      case "create":
        return await handleCreate(interaction);
      case "edit":
        return await handleEdit(interaction);
      case "delete":
        return await handleDelete(interaction);
      case "list":
        return await handleList(interaction);
      case "toggle":
        return await handleToggle(interaction);
    }
  } catch (error) {
    logger.commands.error("cc", username, userId, error, guildId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "An error occurred while executing the custom command.",
      });
    } else {
      await interaction.reply({
        content: "An error occurred while executing the custom command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleRun(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true).toLowerCase();

  const cmd = await prisma.discordCustomCommand.findUnique({
    where: { guildId_name: { guildId, name } },
  });

  if (!cmd || !cmd.enabled) {
    await interaction.reply({
      content: `Custom command \`${name}\` not found or disabled.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check role restrictions
  if (cmd.allowedRoles.length > 0) {
    const member = interaction.member;
    if (member && "roles" in member) {
      const memberRoles =
        "cache" in member.roles ? member.roles.cache : null;
      const hasRole = cmd.allowedRoles.some((r) => memberRoles?.has(r));
      if (!hasRole) {
        await interaction.reply({
          content: "You don't have the required role to use this command.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  }

  const variables = getVariables(interaction);
  const flags = cmd.ephemeral ? MessageFlags.Ephemeral : undefined;

  // Build response
  const embed = cmd.embedJson
    ? buildCustomEmbed(cmd.embedJson, variables)
    : null;
  const content = cmd.response
    ? replaceTemplateVariables(cmd.response, variables)
    : null;

  if (!embed && !content) {
    await interaction.reply({
      content: "This command has no response configured.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: content ?? undefined,
    embeds: embed ? [embed] : [],
    flags,
  });

  // Increment use count
  await prisma.discordCustomCommand.update({
    where: { id: cmd.id },
    data: { useCount: { increment: 1 } },
  });

  logger.commands.success("cc run", interaction.user.username, interaction.user.id, guildId);
}

async function handleCreate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content: "You need the Mod role to manage custom commands.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const name = interaction.options
    .getString("name", true)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const response = interaction.options.getString("response", true);
  const description =
    interaction.options.getString("description") ?? "A custom command";
  const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

  if (!name || name.length < 1 || name.length > 32) {
    await interaction.editReply({
      content:
        "Command name must be 1-32 characters, lowercase letters, numbers, and hyphens only.",
    });
    return;
  }

  const existing = await prisma.discordCustomCommand.findUnique({
    where: { guildId_name: { guildId, name } },
  });

  if (existing) {
    await interaction.editReply({
      content: `Custom command \`${name}\` already exists. Use \`/cc edit\` to modify it.`,
    });
    return;
  }

  await prisma.discordCustomCommand.create({
    data: {
      guildId,
      name,
      description,
      response,
      ephemeral,
      createdBy: interaction.user.id,
    },
  });

  await interaction.editReply({
    content: `Custom command \`${name}\` created. Use \`/cc run ${name}\` to test it.`,
  });
  logger.commands.success("cc create", interaction.user.username, interaction.user.id, guildId);
}

async function handleEdit(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content: "You need the Mod role to manage custom commands.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true).toLowerCase();

  const cmd = await prisma.discordCustomCommand.findUnique({
    where: { guildId_name: { guildId, name } },
  });

  if (!cmd) {
    await interaction.editReply({
      content: `Custom command \`${name}\` not found.`,
    });
    return;
  }

  const data: Record<string, unknown> = {};
  const response = interaction.options.getString("response");
  const description = interaction.options.getString("description");
  const ephemeral = interaction.options.getBoolean("ephemeral");

  if (response !== null) data.response = response;
  if (description !== null) data.description = description;
  if (ephemeral !== null) data.ephemeral = ephemeral;

  if (Object.keys(data).length === 0) {
    await interaction.editReply({
      content: "No changes provided.",
    });
    return;
  }

  await prisma.discordCustomCommand.update({
    where: { id: cmd.id },
    data,
  });

  await interaction.editReply({
    content: `Custom command \`${name}\` updated.`,
  });
  logger.commands.success("cc edit", interaction.user.username, interaction.user.id, guildId);
}

async function handleDelete(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await hasPermission(interaction, "admin"))) {
    await interaction.reply({
      content: "You need the Admin role to delete custom commands.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true).toLowerCase();

  const deleted = await prisma.discordCustomCommand.deleteMany({
    where: { guildId, name },
  });

  if (deleted.count === 0) {
    await interaction.editReply({
      content: `Custom command \`${name}\` not found.`,
    });
    return;
  }

  await interaction.editReply({
    content: `Custom command \`${name}\` deleted.`,
  });
  logger.commands.success("cc delete", interaction.user.username, interaction.user.id, guildId);
}

async function handleList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;

  const commands = await prisma.discordCustomCommand.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
  });

  if (commands.length === 0) {
    await interaction.editReply({
      content: "No custom commands configured. Use `/cc create` to add one.",
    });
    return;
  }

  const lines = commands.map((c) => {
    const status = c.enabled ? "✅" : "❌";
    return `${status} \`${c.name}\` — ${c.description} (used ${c.useCount}×)`;
  });

  const embed = new EmbedBuilder()
    .setTitle("Custom Commands")
    .setDescription(lines.join("\n"))
    .setColor(BRAND_COLOR)
    .setFooter({ text: `${commands.length} commands` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.commands.success("cc list", interaction.user.username, interaction.user.id, guildId);
}

async function handleToggle(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content: "You need the Mod role to manage custom commands.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const name = interaction.options.getString("name", true).toLowerCase();

  const cmd = await prisma.discordCustomCommand.findUnique({
    where: { guildId_name: { guildId, name } },
  });

  if (!cmd) {
    await interaction.editReply({
      content: `Custom command \`${name}\` not found.`,
    });
    return;
  }

  const newState = !cmd.enabled;
  await prisma.discordCustomCommand.update({
    where: { id: cmd.id },
    data: { enabled: newState },
  });

  await interaction.editReply({
    content: `Custom command \`${name}\` ${newState ? "enabled" : "disabled"}.`,
  });
  logger.commands.success("cc toggle", interaction.user.username, interaction.user.id, guildId);
}
