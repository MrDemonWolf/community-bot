import type { Client } from "discord.js";
import type { DiscordGuild } from "@community-bot/db";

import { db, eq, discordGuilds } from "@community-bot/db";
import logger from "./logger.js";

export async function pruneGuilds(client: Client) {
  try {
    const guildsInDb = await db.query.discordGuilds.findMany();

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
        await db.delete(discordGuilds).where(eq(discordGuilds.guildId, guild.guildId));

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
    const currentGuilds = await db.query.discordGuilds.findMany();
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
        await db.insert(discordGuilds).values({
            guildId: guild.id,
            name: guild.name,
            icon: guild.icon,
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

/**
 * Ensures a guild record exists in the database, creating one if needed.
 * Returns true if the guild already existed, false if it was just created.
 */
export async function ensureGuild(guildId: string) {
  const result = await db.insert(discordGuilds).values({ guildId }).onConflictDoNothing({ target: discordGuilds.guildId }).returning();
  return result.length === 0; // true if already existed
}

export async function syncGuildMetadata(client: Client) {
  try {
    const guildsInDb = await db.query.discordGuilds.findMany();

    let updated = 0;
    for (const dbGuild of guildsInDb) {
      const cachedGuild = client.guilds.cache.get(dbGuild.guildId);
      if (!cachedGuild) continue;

      if (dbGuild.name !== cachedGuild.name || dbGuild.icon !== cachedGuild.icon) {
        await db.update(discordGuilds).set({
            name: cachedGuild.name,
            icon: cachedGuild.icon,
          }).where(eq(discordGuilds.guildId, dbGuild.guildId));
        updated++;
      }
    }

    if (updated > 0) {
      logger.success(
        "Discord - Guild Database",
        `Synced metadata for ${updated} guild(s)`
      );
    } else {
      logger.info(
        "Discord - Guild Database",
        "All guild metadata is up to date"
      );
    }
  } catch (err) {
    logger.error(
      "Discord - Guild Database",
      "Error syncing guild metadata",
      err
    );
  }
}
