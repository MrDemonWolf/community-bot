import { MessageFlags } from "discord.js";

import type {
  Client,
  Interaction,
  ChatInputCommandInteraction,
} from "discord.js";

import commands from "../commands/index.js";
import logger from "../utils/logger.js";

export async function interactionCreateEvent(
  _client: Client,
  interaction: Interaction
) {
  try {
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

    const interactionWithError =
      interaction as unknown as ChatInputCommandInteraction;

    if (interactionWithError.deferred || interactionWithError.replied) {
      await interactionWithError.editReply({
        content: "There was an error while executing this command!",
      });
    } else {
      await interactionWithError.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
