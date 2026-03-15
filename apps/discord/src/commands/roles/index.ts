import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type {
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";

import { db, eq, and, asc, discordRolePanels, discordRoleButtons } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import { sendPaginatedEmbed } from "../../utils/pagination.js";

const BRAND_COLOR = 0x00aced;

const BUTTON_STYLES: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

export const rolesCommand = new SlashCommandBuilder()
  .setName("roles")
  .setDescription("Manage self-assignable role panels")
  .addSubcommandGroup((group) =>
    group
      .setName("panel")
      .setDescription("Manage role panels")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new role panel")
          .addStringOption((opt) =>
            opt.setName("name").setDescription("Panel name").setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("title")
              .setDescription("Panel embed title")
              .setRequired(false)
          )
          .addStringOption((opt) =>
            opt
              .setName("description")
              .setDescription("Panel embed description")
              .setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt
              .setName("use-menu")
              .setDescription("Use a select menu instead of buttons")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Delete a role panel")
          .addStringOption((opt) =>
            opt
              .setName("name")
              .setDescription("Panel name")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List all role panels")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("button")
      .setDescription("Manage buttons on a panel")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a role button to a panel")
          .addStringOption((opt) =>
            opt
              .setName("panel")
              .setDescription("Panel name")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("Role to assign")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("label")
              .setDescription("Button label")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("emoji")
              .setDescription("Button emoji (e.g. 🎮)")
              .setRequired(false)
          )
          .addStringOption((opt) =>
            opt
              .setName("style")
              .setDescription("Button style")
              .setRequired(false)
              .addChoices(
                { name: "Primary (Blue)", value: "primary" },
                { name: "Secondary (Grey)", value: "secondary" },
                { name: "Success (Green)", value: "success" },
                { name: "Danger (Red)", value: "danger" }
              )
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a role button from a panel")
          .addStringOption((opt) =>
            opt
              .setName("panel")
              .setDescription("Panel name")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("Role to remove")
              .setRequired(true)
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("post")
      .setDescription("Post (or re-post) a role panel to a channel")
      .addStringOption((opt) =>
        opt
          .setName("panel")
          .setDescription("Panel name")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to post to (defaults to current)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("refresh")
      .setDescription("Refresh an already-posted panel (updates buttons/menu)")
      .addStringOption((opt) =>
        opt
          .setName("panel")
          .setDescription("Panel name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  ) as SlashCommandBuilder;

export async function handleRolesCommand(
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
    "Roles Command",
    `Routing: ${subcommandGroup ?? ""}/${subcommand}`
  );

  if (subcommandGroup === "panel") {
    switch (subcommand) {
      case "create":
        return handlePanelCreate(interaction, guildId);
      case "delete":
        return handlePanelDelete(interaction, guildId);
      case "list":
        return handlePanelList(interaction, guildId);
    }
  }

  if (subcommandGroup === "button") {
    switch (subcommand) {
      case "add":
        return handleButtonAdd(interaction, guildId);
      case "remove":
        return handleButtonRemove(interaction, guildId);
    }
  }

  switch (subcommand) {
    case "post":
      return handlePost(interaction, guildId);
    case "refresh":
      return handleRefresh(interaction, guildId);
  }
}

async function handlePanelCreate(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true).toLowerCase();
    const title = interaction.options.getString("title") ?? "Role Selection";
    const description =
      interaction.options.getString("description") ??
      "Click a button or select an option to toggle a role.";
    const useMenu = interaction.options.getBoolean("use-menu") ?? false;

    const existing = await db.query.discordRolePanels.findFirst({
      where: and(eq(discordRolePanels.guildId, guildId), eq(discordRolePanels.name, name)),
    });

    if (existing) {
      await interaction.editReply({
        content: `A panel named **${name}** already exists.`,
      });
      return;
    }

    await db.insert(discordRolePanels).values({
        guildId,
        name,
        title,
        description,
        useMenu,
        createdBy: interaction.user.id,
      });

    await interaction.editReply({
      content: `Panel **${name}** created (${useMenu ? "select menu" : "buttons"}). Add roles with \`/roles button add\`, then post with \`/roles post\`.`,
    });
    logger.commands.success("roles panel create", username, userId, guildId);
  } catch (error) {
    logger.commands.error(
      "roles panel create",
      username,
      userId,
      error,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while creating the panel.",
    });
  }
}

async function handlePanelDelete(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("panel", false)
      ?? interaction.options.getString("name", true);

    const deleted = await db.delete(discordRolePanels).where(and(eq(discordRolePanels.guildId, guildId), eq(discordRolePanels.name, name.toLowerCase()))).returning();

    if (deleted.length === 0) {
      await interaction.editReply({
        content: `Panel **${name}** not found.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Panel **${name}** deleted.`,
    });
    logger.commands.success("roles panel delete", username, userId, guildId);
  } catch (error) {
    logger.commands.error(
      "roles panel delete",
      username,
      userId,
      error,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while deleting the panel.",
    });
  }
}

async function handlePanelList(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panels = await db.query.discordRolePanels.findMany({
      where: eq(discordRolePanels.guildId, guildId),
      with: { buttons: { orderBy: asc(discordRoleButtons.position) } },
      orderBy: asc(discordRolePanels.name),
    });

    if (panels.length === 0) {
      await interaction.editReply({
        content:
          "No role panels found. Use `/roles panel create` to add one.",
      });
      return;
    }

    const perPage = 5;
    const pages: EmbedBuilder[] = [];

    for (let i = 0; i < panels.length; i += perPage) {
      const chunk = panels.slice(i, i + perPage);
      const embed = new EmbedBuilder()
        .setTitle("Role Panels")
        .setColor(BRAND_COLOR)
        .addFields(
          chunk.map((p) => {
            const mode = p.useMenu ? "Select Menu" : "Buttons";
            const posted = p.messageId ? "Posted" : "Not posted";
            const roles = p.buttons.map((b) => `<@&${b.roleId}>`).join(", ") || "None";
            return {
              name: p.name,
              value: `Mode: ${mode} | ${posted}\nRoles: ${roles}`,
            };
          })
        )
        .setFooter({
          text: `${panels.length} panel${panels.length === 1 ? "" : "s"} total`,
        });

      pages.push(embed);
    }

    await sendPaginatedEmbed({ interaction, pages });
    logger.commands.success("roles panel list", username, userId, guildId);
  } catch (error) {
    logger.commands.error(
      "roles panel list",
      username,
      userId,
      error,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while listing panels.",
    });
  }
}

async function handleButtonAdd(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelName = interaction.options
      .getString("panel", true)
      .toLowerCase();
    const role = interaction.options.getRole("role", true);
    const label = interaction.options.getString("label", true);
    const emoji = interaction.options.getString("emoji");
    const styleKey = interaction.options.getString("style") ?? "primary";
    const style = BUTTON_STYLES[styleKey] ?? ButtonStyle.Primary;

    const panel = await db.query.discordRolePanels.findFirst({
      where: and(eq(discordRolePanels.guildId, guildId), eq(discordRolePanels.name, panelName)),
      with: { buttons: true },
    });

    if (!panel) {
      await interaction.editReply({
        content: `Panel **${panelName}** not found.`,
      });
      return;
    }

    if (panel.buttons.length >= 25) {
      await interaction.editReply({
        content: "A panel can have at most 25 role buttons.",
      });
      return;
    }

    const existingBtn = panel.buttons.find((b) => b.roleId === role.id);
    if (existingBtn) {
      await interaction.editReply({
        content: `Role <@&${role.id}> is already on this panel.`,
      });
      return;
    }

    await db.insert(discordRoleButtons).values({
        panelId: panel.id,
        roleId: role.id,
        label,
        emoji,
        style,
        position: panel.buttons.length,
      });

    await interaction.editReply({
      content: `Added <@&${role.id}> to panel **${panelName}**.`,
    });
    logger.commands.success("roles button add", username, userId, guildId);
  } catch (error) {
    logger.commands.error(
      "roles button add",
      username,
      userId,
      error,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while adding the button.",
    });
  }
}

async function handleButtonRemove(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelName = interaction.options
      .getString("panel", true)
      .toLowerCase();
    const role = interaction.options.getRole("role", true);

    const panel = await db.query.discordRolePanels.findFirst({
      where: and(eq(discordRolePanels.guildId, guildId), eq(discordRolePanels.name, panelName)),
    });

    if (!panel) {
      await interaction.editReply({
        content: `Panel **${panelName}** not found.`,
      });
      return;
    }

    const deleted = await db.delete(discordRoleButtons).where(and(eq(discordRoleButtons.panelId, panel.id), eq(discordRoleButtons.roleId, role.id))).returning();

    if (deleted.length === 0) {
      await interaction.editReply({
        content: `Role <@&${role.id}> is not on panel **${panelName}**.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Removed <@&${role.id}> from panel **${panelName}**.`,
    });
    logger.commands.success("roles button remove", username, userId, guildId);
  } catch (error) {
    logger.commands.error(
      "roles button remove",
      username,
      userId,
      error,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while removing the button.",
    });
  }
}

/**
 * Build the Discord components (buttons or select menu) for a panel.
 */
function buildPanelComponents(
  panel: {
    id: string;
    useMenu: boolean;
    buttons: { roleId: string; label: string; emoji: string | null; style: number }[];
  }
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  if (panel.buttons.length === 0) return [];

  if (panel.useMenu) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`rolemenu:${panel.id}`)
      .setPlaceholder("Select roles to toggle")
      .setMinValues(1)
      .setMaxValues(panel.buttons.length);

    for (const btn of panel.buttons) {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(btn.label)
        .setValue(btn.roleId);
      if (btn.emoji) option.setEmoji(btn.emoji);
      menu.addOptions(option);
    }

    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    ];
  }

  // Button mode — Discord allows 5 buttons per row, up to 5 rows
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < panel.buttons.length; i += 5) {
    const chunk = panel.buttons.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const btn of chunk) {
      const button = new ButtonBuilder()
        .setCustomId(`role:toggle:${btn.roleId}`)
        .setLabel(btn.label)
        .setStyle(btn.style as ButtonStyle);
      if (btn.emoji) button.setEmoji(btn.emoji);
      row.addComponents(button);
    }

    rows.push(row);
  }

  return rows;
}

async function handlePost(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelName = interaction.options
      .getString("panel", true)
      .toLowerCase();
    const targetChannel = (interaction.options.getChannel("channel") ??
      interaction.channel) as TextChannel | null;

    if (!targetChannel || !("send" in targetChannel)) {
      await interaction.editReply({
        content: "Cannot send to this channel.",
      });
      return;
    }

    const panel = await db.query.discordRolePanels.findFirst({
      where: and(eq(discordRolePanels.guildId, guildId), eq(discordRolePanels.name, panelName)),
      with: { buttons: { orderBy: asc(discordRoleButtons.position) } },
    });

    if (!panel) {
      await interaction.editReply({
        content: `Panel **${panelName}** not found.`,
      });
      return;
    }

    if (panel.buttons.length === 0) {
      await interaction.editReply({
        content: `Panel **${panelName}** has no roles. Add some with \`/roles button add\`.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(panel.title ?? "Role Selection")
      .setDescription(
        panel.description ??
          "Click a button or use the menu below to toggle a role."
      )
      .setColor(BRAND_COLOR);

    const components = buildPanelComponents(panel);

    const message = await targetChannel.send({
      embeds: [embed],
      components,
    });

    await db.update(discordRolePanels).set({ channelId: targetChannel.id, messageId: message.id }).where(eq(discordRolePanels.id, panel.id));

    await interaction.editReply({
      content: `Panel **${panelName}** posted to <#${targetChannel.id}>.`,
    });
    logger.commands.success("roles post", username, userId, guildId);
  } catch (error) {
    logger.commands.error("roles post", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while posting the panel.",
    });
  }
}

async function handleRefresh(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelName = interaction.options
      .getString("panel", true)
      .toLowerCase();

    const panel = await db.query.discordRolePanels.findFirst({
      where: and(eq(discordRolePanels.guildId, guildId), eq(discordRolePanels.name, panelName)),
      with: { buttons: { orderBy: asc(discordRoleButtons.position) } },
    });

    if (!panel) {
      await interaction.editReply({
        content: `Panel **${panelName}** not found.`,
      });
      return;
    }

    if (!panel.channelId || !panel.messageId) {
      await interaction.editReply({
        content: `Panel **${panelName}** hasn't been posted yet. Use \`/roles post\` first.`,
      });
      return;
    }

    const channel = interaction.guild?.channels.cache.get(
      panel.channelId
    ) as TextChannel | undefined;

    if (!channel) {
      await interaction.editReply({
        content: "The channel this panel was posted in no longer exists.",
      });
      return;
    }

    try {
      const message = await channel.messages.fetch(panel.messageId);
      const embed = new EmbedBuilder()
        .setTitle(panel.title ?? "Role Selection")
        .setDescription(
          panel.description ??
            "Click a button or use the menu below to toggle a role."
        )
        .setColor(BRAND_COLOR);

      const components = buildPanelComponents(panel);

      await message.edit({ embeds: [embed], components });

      await interaction.editReply({
        content: `Panel **${panelName}** refreshed.`,
      });
      logger.commands.success("roles refresh", username, userId, guildId);
    } catch {
      await interaction.editReply({
        content:
          "Could not find the original message. Use `/roles post` to post it again.",
      });
    }
  } catch (error) {
    logger.commands.error("roles refresh", username, userId, error, guildId);
    await interaction.editReply({
      content: "An error occurred while refreshing the panel.",
    });
  }
}
