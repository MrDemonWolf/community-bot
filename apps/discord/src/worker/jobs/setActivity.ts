import { ActivityType } from "discord.js";

import type { Client } from "discord.js";

import { db, eq, discordGuilds } from "@community-bot/db";
import env from "../../utils/env.js";
import logger from "../../utils/logger.js";

// Safe lookup for ActivityType enum with fallback to Playing
const getActivityType = (activityTypeString: string): ActivityType => {
  const activityType =
    ActivityType[activityTypeString as keyof typeof ActivityType];
  return activityType !== undefined ? activityType : ActivityType.Playing;
};

export default async (client: Client) => {
  try {
    if (!client.user) {
      return logger.warn(
        "Discord - Activity",
        "Client user is not defined, cannot set activity"
      );
    }

    // Try to read presence config from the database
    let activityText: string | undefined;
    let activityType: string | undefined;
    let activityUrl: string | undefined;

    try {
      // Find the first guild that has a custom activity configured
      const guild = await db.query.discordGuilds.findFirst({
        where: eq(discordGuilds.enabled, true),
      });

      if (guild?.activityText) {
        activityText = guild.activityText;
        activityType = guild.activityType ?? "CUSTOM";
        activityUrl = guild.activityUrl ?? undefined;
      }
    } catch (err) {
      logger.warn(
        "Discord - Activity",
        "Failed to read presence config from database, falling back to env vars",
        err as Record<string, unknown>
      );
    }

    // Fall back to environment variables if no DB config exists
    const finalActivity = activityText ?? env.DISCORD_DEFAULT_STATUS;
    const finalActivityType = activityType ?? env.DISCORD_DEFAULT_ACTIVITY_TYPE;
    const finalActivityUrl = activityUrl ?? env.DISCORD_DEFAULT_ACTIVITY_URL;

    const safeActivityType = getActivityType(finalActivityType);

    client.user.setActivity(finalActivity, {
      type: safeActivityType,
      url: finalActivityUrl,
    });
    logger.success("Discord - Activity", "Activity has been set", {
      activity: finalActivity,
      type: safeActivityType,
      url: finalActivityUrl,
    });
    return true;
  } catch (err) {
    logger.error(
      "Discord - Activity",
      "Error setting custom discord activity",
      err
    );
  }
};
