import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { twitchCommand, handleTwitchCommand } from "./twitch/index.js";
import { quoteCommand, handleQuoteCommand } from "./quote/index.js";
import { helpCommand, handleHelpCommand } from "./help/index.js";
import { configCommand, handleConfigCommand } from "./config/index.js";
import {
  templateCommand,
  handleTemplateCommand,
} from "./template/index.js";
import {
  scheduleCommand,
  handleScheduleCommand,
} from "./schedule/index.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Map<string, Command>();

commands.set(twitchCommand.name, {
  data: twitchCommand,
  execute: handleTwitchCommand,
});

commands.set(quoteCommand.name, {
  data: quoteCommand,
  execute: handleQuoteCommand,
});

commands.set(helpCommand.name, {
  data: helpCommand,
  execute: handleHelpCommand,
});

commands.set(configCommand.name, {
  data: configCommand,
  execute: handleConfigCommand,
});

commands.set(templateCommand.name, {
  data: templateCommand,
  execute: handleTemplateCommand,
});

commands.set(scheduleCommand.name, {
  data: scheduleCommand,
  execute: handleScheduleCommand,
});

export default commands;
