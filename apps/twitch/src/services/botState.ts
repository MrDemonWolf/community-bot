import { prisma } from "@community-bot/db";
import { logger } from "../utils/logger.js";

// Map<twitchUsername (lowercase), boolean>
const mutedChannels = new Map<string, boolean>();

export async function loadMutedState(): Promise<void> {
  const channels = await prisma.botChannel.findMany({
    where: { enabled: true },
  });

  mutedChannels.clear();
  for (const ch of channels) {
    if (ch.muted) {
      mutedChannels.set(ch.twitchUsername.toLowerCase(), true);
    }
  }

  logger.info(
    "BotState",
    `Loaded muted state: ${mutedChannels.size} channels muted`
  );
}

export function isMuted(channelName?: string): boolean {
  if (!channelName) {
    // Global check: any channel muted (backwards compat)
    return mutedChannels.size > 0;
  }
  const username = channelName.replace(/^#/, "").toLowerCase();
  return mutedChannels.get(username) === true;
}

export function setMuted(channelName: string, value: boolean): void {
  const username = channelName.replace(/^#/, "").toLowerCase();
  if (value) {
    mutedChannels.set(username, true);
  } else {
    mutedChannels.delete(username);
  }
}
