import type { Client } from "discord.js";
import type { DiscordGuild } from "@community-bot/db";

import { prisma } from "@community-bot/db";
import logger from "./logger.js";

export async function pruneGuilds(client: Client) {
  try {
    const guildsInDb = await prisma.discordGuild.findMany({});

    const guildsInCache = client.guilds.cache.map((guild) => guild.id);

    /**
     * Double check if there are guilds in the database and cache. If not, return early.
     * This is to prevent issues if cache is empty or database is empty.
     */
    if (guildsInDb.length === 0) {
      logger.info(
        "Discord Event Logger",
        "No guilds found in the database for cleanup"
      );
      return;
    }

    if (guildsInCache.length === 0) {
      logger.info(
        "Discord Event Logger",
        "No guilds found in the cache for cleanup"
      );
      return;
    }
    const guildsToRemove = guildsInDb.filter(
      (guild: DiscordGuild) =>
        client.guilds.cache.get(guild.guildId) === undefined
    );

    if (guildsToRemove.length === 0) {
      logger.info(
        "Discord Event Logger",
        "No guilds to remove from the database"
      );
      return;
    }

    logger.info("Discord - Guild Database", "Starting guild cleanup", {
      guildsToRemove: guildsToRemove.length,
    });

    for (const guild of guildsToRemove) {
      try {
        await prisma.discordGuild.delete({
          where: {
            guildId: guild.guildId,
          },
        });

        logger.success(
          "Discord - Guild Database",
          "Removed guild from database",
          {
            guildId: guild.guildId,
          }
        );
      } catch (err) {
        logger.error(
          "Discord Event Logger",
          "Error removing guild from database",
          err,
          {
            guildId: guild.guildId,
          }
        );
      }
    }
    logger.info(
      "Discord Event Logger",
      "Finished cleaning up guilds in the database"
    );
  } catch (err) {
    logger.error(
      "Discord Event Logger",
      "Error during cleaning of the database",
      err,
      {
        operation: "pruneGuilds",
      }
    );
  }
}

export async function ensureGuildExists(client: Client) {
  try {
    const currentGuilds = await prisma.discordGuild.findMany({});
    const guildsToAdd = client.guilds.cache.filter(
      (guild) =>
        !currentGuilds.some((currentGuild: DiscordGuild) => currentGuild.guildId === guild.id)
    );

    if (guildsToAdd.size === 0) {
      logger.info(
        "Discord Event Logger",
        "No new guilds to add to the database"
      );
      return;
    }

    logger.info("Discord - Guild Database", "Adding new guilds to database", {
      guildsToAdd: guildsToAdd.size,
    });

    for (const guild of guildsToAdd.values()) {
      try {
        await prisma.discordGuild.create({
          data: {
            guildId: guild.id,
          },
        });

        logger.success(
          "Discord - Guild Database",
          "Created guild in database",
          {
            guildId: guild.id,
            guildName: guild.name,
          }
        );
      } catch (err) {
        logger.error(
          "Discord Event Logger",
          "Error adding guild to the database",
          err,
          {
            operation: "ensureGuildExists",
            guildId: guild.id,
            guildName: guild.name,
          }
        );
      }
    }
    logger.info(
      "Discord Event Logger",
      "Finished ensuring guilds exist in the database"
    );
  } catch (err) {
    logger.error(
      "Discord Event Logger",
      "Error during ensuring guild exists in the database",
      err,
      {
        operation: "ensureGuildExists",
      }
    );
  }
}

export async function guildExists(guildId: string) {
  const guildExists = await prisma.discordGuild.findUnique({
    where: {
      guildId,
    },
  });

  if (!guildExists) {
    await prisma.discordGuild.create({
      data: {
        guildId,
      },
    });
    return false;
  }
  return true;
}
