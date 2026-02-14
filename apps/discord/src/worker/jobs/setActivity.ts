import { ActivityType } from "discord.js";

import type { Client } from "discord.js";

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
    const defaultActivity = env.DISCORD_DEFAULT_STATUS;
    const defaultActivityType = env.DISCORD_DEFAULT_ACTIVITY_TYPE;
    const defaultActivityUrl = env.DEFAULT_ACTIVITY_URL;

    if (!client.user) {
      return logger.warn(
        "Discord - Activity",
        "Client user is not defined, cannot set activity"
      );
    }

    const safeActivityType = getActivityType(defaultActivityType);

    client.user.setActivity(defaultActivity, {
      type: safeActivityType,
      url: defaultActivityUrl,
    });
    logger.success("Discord - Activity", "Activity has been set", {
      activity: defaultActivity,
      type: safeActivityType,
      url: defaultActivityUrl,
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
