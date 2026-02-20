import { TwitchCommand } from "../types/command.js";
import { ping } from "./ping.js";
import { reloadCommands } from "./reloadCommands.js";
import { command } from "./command.js";
import { uptime } from "./uptime.js";
import { accountage } from "./accountage.js";
import { bot } from "./bot.js";
import { queue } from "./queue.js";
import { filesay } from "./filesay.js";
import { commandsPage } from "./commands.js";

export const commands = new Map<string, TwitchCommand>();

commands.set(ping.name, ping);
commands.set(reloadCommands.name, reloadCommands);
commands.set(command.name, command);
commands.set(uptime.name, uptime);
commands.set(accountage.name, accountage);
commands.set("accage", accountage);
commands.set("created", accountage);
commands.set(bot.name, bot);
commands.set(queue.name, queue);
commands.set(filesay.name, filesay);
commands.set(commandsPage.name, commandsPage);
