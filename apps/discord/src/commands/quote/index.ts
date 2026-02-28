import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { handleQuoteShow } from "./show.js";
import { handleQuoteAdd } from "./add.js";
import { handleQuoteRemove } from "./remove.js";
import { handleQuoteSearch } from "./search.js";
import logger from "../../utils/logger.js";

export const quoteCommand = new SlashCommandBuilder()
  .setName("quote")
  .setDescription("View and manage stream quotes")
  .addSubcommand((sub) =>
    sub
      .setName("show")
      .setDescription("Show a random quote or a specific one by number")
      .addIntegerOption((opt) =>
        opt
          .setName("number")
          .setDescription("Quote number to show (omit for random)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a new quote")
      .addStringOption((opt) =>
        opt
          .setName("text")
          .setDescription("The quote text")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a quote by number")
      .addIntegerOption((opt) =>
        opt
          .setName("number")
          .setDescription("Quote number to remove")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("search")
      .setDescription("Search quotes by text")
      .addStringOption((opt) =>
        opt
          .setName("text")
          .setDescription("Text to search for")
          .setRequired(true)
      )
  ) as SlashCommandBuilder;

export async function handleQuoteCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  logger.debug("Quote Command", `Routing: ${subcommand}`);

  switch (subcommand) {
    case "show":
      return handleQuoteShow(interaction);
    case "add":
      return handleQuoteAdd(interaction);
    case "remove":
      return handleQuoteRemove(interaction);
    case "search":
      return handleQuoteSearch(interaction);
  }
}
