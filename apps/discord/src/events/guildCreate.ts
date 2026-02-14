import type { Guild } from "discord.js";

import { prisma } from "@community-bot/db";
import logger from "../utils/logger.js";

export async function guildCreateEvent(guild: Guild): Promise<void> {
  try {
    /**
     * Show the bot has joined a new guild in the console.
     * This is shared across all shards.
     */
    logger.discord.guildJoined(guild.name, guild.id, guild.memberCount);

    /**
     * Add the guild to the database.
     */
    const guildData = await prisma.discordGuild.create({
      data: {
        guildId: guild.id,
      },
    });

    logger.database.operation("Guild added to database", {
      guildId: guildData.guildId,
    });
  } catch (err) {
    logger.error(
      "Discord - Event (Guild Create)",
      "Error joining a new guild",
      err,
      {
        guildId: guild.id,
        guildName: guild.name,
      }
    );
  }
}
