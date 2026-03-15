import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { db, eq, and, asc, discordMessageTemplates } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import { buildCustomEmbed } from "../../utils/embeds.js";
import { sendPaginatedEmbed } from "../../utils/pagination.js";

const BRAND_COLOR = 0x00aced;

export const templateCommand = new SlashCommandBuilder()
  .setName("template")
  .setDescription("Manage message templates")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new message template")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Template name").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("content")
          .setDescription("Message content (text)")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("embed-json")
          .setDescription("Embed JSON (Discord embed structure)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit an existing template")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Template name")
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
          .setName("embed-json")
          .setDescription("New embed JSON")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a template")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Template name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all templates")
  )
  .addSubcommand((sub) =>
    sub
      .setName("preview")
      .setDescription("Preview a template")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Template name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("send")
      .setDescription("Send a template to a channel")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Template name")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to send the template to")
          .setRequired(false)
      )
  ) as SlashCommandBuilder;

export async function handleTemplateCommand(
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
    case "preview":
      return handlePreview(interaction, guildId);
    case "send":
      return handleSend(interaction, guildId);
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
    const content = interaction.options.getString("content");
    const embedJson = interaction.options.getString("embed-json");

    if (!content && !embedJson) {
      await interaction.editReply({
        content: "You must provide either content or embed-json (or both).",
      });
      return;
    }

    const existing = await db.query.discordMessageTemplates.findFirst({
      where: and(eq(discordMessageTemplates.guildId, guildId), eq(discordMessageTemplates.name, name)),
    });

    if (existing) {
      await interaction.editReply({
        content: `A template named **${name}** already exists. Use \`/template edit\` to modify it.`,
      });
      return;
    }

    if (embedJson) {
      try {
        JSON.parse(embedJson);
      } catch {
        await interaction.editReply({
          content: "Invalid embed JSON. Please provide a valid JSON object.",
        });
        return;
      }
    }

    await db.insert(discordMessageTemplates).values({
        guildId,
        name,
        content,
        embedJson,
        createdBy: interaction.user.id,
      });

    await interaction.editReply({
      content: `Template **${name}** created successfully.`,
    });
    logger.commands.success("template create", username, userId, guildId);
  } catch (error) {
    logger.commands.error("template create", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while creating the template.",
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
    const embedJson = interaction.options.getString("embed-json");

    if (!content && !embedJson) {
      await interaction.editReply({
        content: "You must provide at least one field to update.",
      });
      return;
    }

    if (embedJson) {
      try {
        JSON.parse(embedJson);
      } catch {
        await interaction.editReply({
          content: "Invalid embed JSON. Please provide a valid JSON object.",
        });
        return;
      }
    }

    const template = await db.query.discordMessageTemplates.findFirst({
      where: and(eq(discordMessageTemplates.guildId, guildId), eq(discordMessageTemplates.name, name)),
    });

    if (!template) {
      await interaction.editReply({
        content: `Template **${name}** not found.`,
      });
      return;
    }

    await db.update(discordMessageTemplates).set({
        ...(content !== null && { content }),
        ...(embedJson !== null && { embedJson }),
      }).where(eq(discordMessageTemplates.id, template.id));

    await interaction.editReply({
      content: `Template **${name}** updated successfully.`,
    });
    logger.commands.success("template edit", username, userId, guildId);
  } catch (error) {
    logger.commands.error("template edit", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while editing the template.",
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

    const deleted = await db.delete(discordMessageTemplates).where(and(eq(discordMessageTemplates.guildId, guildId), eq(discordMessageTemplates.name, name))).returning();

    if (deleted.length === 0) {
      await interaction.editReply({
        content: `Template **${name}** not found.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Template **${name}** deleted.`,
    });
    logger.commands.success("template delete", username, userId, guildId);
  } catch (error) {
    logger.commands.error("template delete", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while deleting the template.",
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

    const templates = await db.query.discordMessageTemplates.findMany({
      where: eq(discordMessageTemplates.guildId, guildId),
      orderBy: asc(discordMessageTemplates.name),
    });

    if (templates.length === 0) {
      await interaction.editReply({
        content: "No templates found. Use `/template create` to add one.",
      });
      return;
    }

    const perPage = 10;
    const pages: EmbedBuilder[] = [];

    for (let i = 0; i < templates.length; i += perPage) {
      const chunk = templates.slice(i, i + perPage);
      const embed = new EmbedBuilder()
        .setTitle("Message Templates")
        .setColor(BRAND_COLOR)
        .setDescription(
          chunk
            .map((t) => {
              const hasContent = t.content ? "Text" : "";
              const hasEmbed = t.embedJson ? "Embed" : "";
              const types = [hasContent, hasEmbed].filter(Boolean).join(" + ");
              return `**${t.name}** — ${types}`;
            })
            .join("\n")
        )
        .setFooter({
          text: `${templates.length} template${templates.length === 1 ? "" : "s"} total`,
        });

      pages.push(embed);
    }

    await sendPaginatedEmbed({ interaction, pages });
    logger.commands.success("template list", username, userId, guildId);
  } catch (error) {
    logger.commands.error("template list", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while listing templates.",
    });
  }
}

async function handlePreview(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();

    const template = await db.query.discordMessageTemplates.findFirst({
      where: and(eq(discordMessageTemplates.guildId, guildId), eq(discordMessageTemplates.name, name)),
    });

    if (!template) {
      await interaction.editReply({
        content: `Template **${name}** not found.`,
      });
      return;
    }

    const variables = {
      server: interaction.guild?.name ?? "Server",
      user: interaction.user.username,
      memberCount: String(interaction.guild?.memberCount ?? 0),
    };

    const replyOptions: { content?: string; embeds?: EmbedBuilder[] } = {};

    if (template.content) {
      const { replaceTemplateVariables } = await import(
        "../../utils/embeds.js"
      );
      replyOptions.content = replaceTemplateVariables(
        template.content,
        variables
      );
    }

    if (template.embedJson) {
      const embed = buildCustomEmbed(template.embedJson, variables);
      if (embed) {
        replyOptions.embeds = [embed];
      }
    }

    if (!replyOptions.content && !replyOptions.embeds) {
      await interaction.editReply({
        content: "Template has no previewable content.",
      });
      return;
    }

    await interaction.editReply(replyOptions);
    logger.commands.success("template preview", username, userId, guildId);
  } catch (error) {
    logger.commands.error("template preview", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while previewing the template.",
    });
  }
}

async function handleSend(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();
    const targetChannel =
      interaction.options.getChannel("channel") ?? interaction.channel;

    if (!targetChannel || !("send" in targetChannel)) {
      await interaction.editReply({
        content: "Cannot send to this channel.",
      });
      return;
    }

    const template = await db.query.discordMessageTemplates.findFirst({
      where: and(eq(discordMessageTemplates.guildId, guildId), eq(discordMessageTemplates.name, name)),
    });

    if (!template) {
      await interaction.editReply({
        content: `Template **${name}** not found.`,
      });
      return;
    }

    const variables = {
      server: interaction.guild?.name ?? "Server",
      user: interaction.user.username,
      memberCount: String(interaction.guild?.memberCount ?? 0),
    };

    const sendOptions: { content?: string; embeds?: EmbedBuilder[] } = {};

    if (template.content) {
      const { replaceTemplateVariables } = await import(
        "../../utils/embeds.js"
      );
      sendOptions.content = replaceTemplateVariables(
        template.content,
        variables
      );
    }

    if (template.embedJson) {
      const embed = buildCustomEmbed(template.embedJson, variables);
      if (embed) {
        sendOptions.embeds = [embed];
      }
    }

    if (!sendOptions.content && !sendOptions.embeds) {
      await interaction.editReply({
        content: "Template has no sendable content.",
      });
      return;
    }

    await targetChannel.send(sendOptions);

    await interaction.editReply({
      content: `Template **${name}** sent to <#${targetChannel.id}>.`,
    });
    logger.commands.success("template send", username, userId, guildId);
  } catch (error) {
    logger.commands.error("template send", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while sending the template.",
    });
  }
}
