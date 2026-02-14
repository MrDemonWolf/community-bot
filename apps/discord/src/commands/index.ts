import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { twitchCommand, handleTwitchCommand } from "./twitch/index.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Map<string, Command>();

commands.set(twitchCommand.name, {
  data: twitchCommand,
  execute: handleTwitchCommand,
});

export default commands;
