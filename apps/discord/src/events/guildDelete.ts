import type { Guild } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../utils/logger.js";

export async function guildDeleteEvent(guild: Guild): Promise<void> {
  try {
    /**
     * Delete the guild from the database.
     */
    await prisma.discordGuild.delete({
      where: {
        guildId: guild.id,
      },
    });

    /**
     * Show the bot has left a guild in the console.
     */
    logger.discord.guildLeft(guild.name, guild.id);
    logger.database.operation("Guild removed from database", {
      guildId: guild.id,
    });
  } catch (err) {
    logger.error("Discord - Event (Guild Delete)", "Error leaving guild", err, {
      guildId: guild.id,
      guildName: guild.name,
    });
  }
}
