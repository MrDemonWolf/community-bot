import { MessageFlags } from "discord.js";
import type { StringSelectMenuInteraction } from "discord.js";

import logger from "../utils/logger.js";

export async function selectMenuHandler(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const customId = interaction.customId;

  // Role menu: rolemenu:{panelId}
  if (customId.startsWith("rolemenu:")) {
    await handleRoleMenu(interaction);
    return;
  }
}

async function handleRoleMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
      await interaction.editReply({
        content: "This can only be used in a server.",
      });
      return;
    }

    const selectedRoleIds = interaction.values;
    const guildMember = await interaction.guild.members.fetch(
      interaction.user.id
    );

    const added: string[] = [];
    const removed: string[] = [];

    for (const roleId of selectedRoleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;

      try {
        if (guildMember.roles.cache.has(roleId)) {
          await guildMember.roles.remove(roleId);
          removed.push(role.name);
        } else {
          await guildMember.roles.add(roleId);
          added.push(role.name);
        }
      } catch (err) {
        logger.error("Role Menu", `Failed to toggle role ${role.name}`, err);
      }
    }

    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(`Added: **${added.join("**, **")}**`);
    }
    if (removed.length > 0) {
      parts.push(`Removed: **${removed.join("**, **")}**`);
    }

    if (parts.length === 0) {
      await interaction.editReply({
        content: "No role changes were made.",
      });
      return;
    }

    await interaction.editReply({
      content: parts.join("\n"),
    });

    logger.info(
      "Role Menu",
      `${interaction.user.username} toggled roles`,
      {
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        added,
        removed,
      }
    );
  } catch (error) {
    logger.error("Role Menu", "Failed to handle role menu", error, {
      userId: interaction.user.id,
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content:
          "Failed to update roles. I may not have the required permissions.",
      });
    } else {
      await interaction.reply({
        content:
          "Failed to update roles. I may not have the required permissions.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
