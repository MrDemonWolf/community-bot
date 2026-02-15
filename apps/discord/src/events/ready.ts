import type { Client } from "discord.js";

import setActivity from "../worker/jobs/setActivity.js";
import { pruneGuilds, ensureGuildExists, syncGuildMetadata } from "../utils/guildDatabase.js";
import commands from "../commands/index.js";
import logger from "../utils/logger.js";

export async function readyEvent(client: Client) {
  try {
    /**
     * Show the bot is ready in the console.
     */
    const username = client.user?.tag || "Unknown";
    const guildCount = client.guilds.cache.size;

    logger.discord.ready(username, guildCount);

    /**
     * Check if the bot is not in a guild anymore and remove it from the database.
     */
    await pruneGuilds(client);

    /**
     * Check if guilds exist in the database and add them if they don't.
     */
    await ensureGuildExists(client);

    /**
     * Sync guild name and icon for existing records.
     */
    await syncGuildMetadata(client);

    /**
     * Register slash commands.
     */
    logger.info("Discord - Slash Commands", "Registering commands");

    const commandData = [...commands.values()].map((cmd) => cmd.data);
    await client.application?.commands.set(commandData);

    const registeredCommands = await client.application?.commands.fetch();
    const commandNames =
      registeredCommands?.map((command) => command.name) || [];

    logger.success(
      "Discord - Slash Commands",
      `Registered ${commandNames.length} commands`,
      {
        commands: commandNames,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (err) {
    logger.error("Discord - Event (Ready)", "Error during ready event", err);
  }

  /**
   * Apply the bot's activity status on first run then the worker will handle it every configured interval.
   */
  await setActivity(client);
}
