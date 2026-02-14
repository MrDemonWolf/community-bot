import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../../utils/logger.js";

export async function handleSetRole(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const role = interaction.options.getRole("role", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await prisma.discordGuild.update({
      where: { guildId },
      data: { notificationRoleId: role.id },
    });

    logger.commands.success(
      "twitch notifications set-role",
      interaction.user.username,
      interaction.user.id,
      guildId
    );

    await interaction.editReply({
      content: `Twitch notifications will mention <@&${role.id}>.`,
    });
  } catch (err) {
    logger.commands.error(
      "twitch notifications set-role",
      interaction.user.username,
      interaction.user.id,
      err,
      guildId
    );
    await interaction.editReply({
      content: "An error occurred while setting the notification role.",
    });
  }
}
