import { MessageFlags } from "discord.js";
import type { ButtonInteraction } from "discord.js";

import logger from "../utils/logger.js";

export async function buttonHandler(
  interaction: ButtonInteraction
): Promise<void> {
  const customId = interaction.customId;

  // Role toggle buttons: role:toggle:{roleId}
  if (customId.startsWith("role:toggle:")) {
    const roleId = customId.slice("role:toggle:".length);
    await handleRoleToggle(interaction, roleId);
    return;
  }

  // Pagination buttons are handled by the message collector in pagination.ts,
  // so we don't need to handle them here.
}

async function handleRoleToggle(
  interaction: ButtonInteraction,
  roleId: string
): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = interaction.member;
    if (!member || !("roles" in member) || !interaction.guild) {
      await interaction.editReply({
        content: "Could not determine your roles.",
      });
      return;
    }

    const guildMember = await interaction.guild.members.fetch(
      interaction.user.id
    );
    const role = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      await interaction.editReply({
        content: "This role no longer exists.",
      });
      return;
    }

    if (guildMember.roles.cache.has(roleId)) {
      await guildMember.roles.remove(roleId);
      await interaction.editReply({
        content: `Removed the **${role.name}** role.`,
      });
      logger.info(
        "Role Toggle",
        `${interaction.user.username} removed role ${role.name}`,
        { userId: interaction.user.id, roleId, guildId: interaction.guildId! }
      );
    } else {
      await guildMember.roles.add(roleId);
      await interaction.editReply({
        content: `Added the **${role.name}** role.`,
      });
      logger.info(
        "Role Toggle",
        `${interaction.user.username} added role ${role.name}`,
        { userId: interaction.user.id, roleId, guildId: interaction.guildId! }
      );
    }
  } catch (error) {
    logger.error("Role Toggle", "Failed to toggle role", error, {
      userId: interaction.user.id,
      roleId,
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content:
          "Failed to toggle this role. I may not have the required permissions.",
      });
    } else {
      await interaction.reply({
        content:
          "Failed to toggle this role. I may not have the required permissions.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
