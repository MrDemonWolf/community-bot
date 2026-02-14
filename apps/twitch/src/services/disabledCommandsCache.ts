import { prisma } from "@community-bot/db";
import { logger } from "../utils/logger.js";

// Map<twitchUsername, Set<commandName>>
const disabledMap = new Map<string, Set<string>>();

// Map<twitchUsername, Map<commandName, accessLevel>>
const accessOverrides = new Map<string, Map<string, string>>();

export async function loadDisabledCommands(): Promise<void> {
  const channels = await prisma.botChannel.findMany({
    where: { enabled: true },
    include: { commandOverrides: true },
  });

  disabledMap.clear();
  accessOverrides.clear();

  for (const ch of channels) {
    const username = ch.twitchUsername.toLowerCase();
    disabledMap.set(username, new Set(ch.disabledCommands));

    if (ch.commandOverrides.length > 0) {
      const overrides = new Map<string, string>();
      for (const o of ch.commandOverrides) {
        overrides.set(o.commandName, o.accessLevel);
      }
      accessOverrides.set(username, overrides);
    }
  }

  logger.info(
    "DisabledCommands",
    `Loaded disabled commands for ${channels.length} channels`
  );
}

export async function reloadForChannel(twitchUserId: string): Promise<void> {
  const channel = await prisma.botChannel.findUnique({
    where: { twitchUserId },
    include: { commandOverrides: true },
  });

  if (!channel) return;

  const username = channel.twitchUsername.toLowerCase();
  disabledMap.set(username, new Set(channel.disabledCommands));

  if (channel.commandOverrides.length > 0) {
    const overrides = new Map<string, string>();
    for (const o of channel.commandOverrides) {
      overrides.set(o.commandName, o.accessLevel);
    }
    accessOverrides.set(username, overrides);
  } else {
    accessOverrides.delete(username);
  }
}

export function isCommandDisabled(
  channelName: string,
  commandName: string
): boolean {
  const username = channelName.replace(/^#/, "").toLowerCase();
  const disabled = disabledMap.get(username);
  return disabled ? disabled.has(commandName) : false;
}

export function getAccessLevelOverride(
  channelName: string,
  commandName: string
): string | null {
  const username = channelName.replace(/^#/, "").toLowerCase();
  const overrides = accessOverrides.get(username);
  if (!overrides) return null;
  return overrides.get(commandName) ?? null;
}
