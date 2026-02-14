import { ActivityType } from "discord.js";
import type { Client } from "discord.js";

import { consola } from "consola";

export function setActivity(client: Client) {
  try {
    if (!client.user)
      return consola.error({
        message:
          "[Discord Event Logger - setActivity] Discord bot is not ready",
        badge: true,
        level: "error",
        timestamp: new Date(),
      });

    client.user.setActivity("over the Wolf Lair 🐺", {
      type: ActivityType.Watching,
    });

    consola.success({
      message: `[Discord Event Logger - setActivity] Set custom discord activity to 'Guarding the Lair'`,
      badge: true,
    });
  } catch (err) {
    consola.error({
      message: `[Discord Event Logger - setActivity] Error setting custom discord activity: ${err}`,
      badge: true,
      timestamp: new Date(),
    });
  }
}
