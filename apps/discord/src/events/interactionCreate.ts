import { MessageFlags } from "discord.js";

import type { Interaction } from "discord.js";

import commands from "../commands/index.js";
import logger from "../utils/logger.js";
import { autocompleteEvent } from "./autocomplete.js";
import { buttonHandler } from "./buttonHandler.js";
import { selectMenuHandler } from "./selectMenuHandler.js";

export async function interactionCreateEvent(
  interaction: Interaction
) {
  try {
    if (interaction.isAutocomplete()) {
      await autocompleteEvent(interaction);
      return;
    }

    if (interaction.isButton()) {
      await buttonHandler(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await selectMenuHandler(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    logger.commands.executing(
      interaction.commandName,
      interaction.user.username,
      interaction.user.id
    );

    const command = commands.get(interaction.commandName);

    if (!command) {
      logger.warn(
        "Discord - Command",
        `Unknown command: ${interaction.commandName}`
      );
      return;
    }

    await command.execute(interaction);
  } catch (err) {
    logger.error("Discord - Command", "Error executing command", err, {
      user: { username: interaction.user.username, id: interaction.user.id },
      command: interaction.isCommand() ? interaction.commandName : "unknown",
    });

    if (!interaction.isRepliable()) return;

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "There was an error while executing this command!",
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
