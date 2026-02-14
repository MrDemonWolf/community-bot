import { prisma } from "@community-bot/db";
import { logger } from "../utils/logger.js";
import type { TwitchChatCommand } from "@community-bot/db";

export type CachedCommand = TwitchChatCommand & {
  compiledRegex?: RegExp;
};

function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}

class CommandCache {
  // Per-channel command maps: channelUsername -> (name/alias -> command)
  private channelPrefixMaps = new Map<string, Map<string, CachedCommand>>();
  private channelRegexMaps = new Map<string, CachedCommand[]>();

  // Global commands (botChannelId is null) — legacy/fallback
  private globalPrefixMap = new Map<string, CachedCommand>();
  private globalRegexCommands: CachedCommand[] = [];

  async load(): Promise<void> {
    const commands = await prisma.twitchChatCommand.findMany({
      where: { enabled: true },
      include: { botChannel: true },
    });

    const newChannelPrefixMaps = new Map<string, Map<string, CachedCommand>>();
    const newChannelRegexMaps = new Map<string, CachedCommand[]>();
    const newGlobalPrefixMap = new Map<string, CachedCommand>();
    const newGlobalRegexCommands: CachedCommand[] = [];

    for (const cmd of commands) {
      const cached: CachedCommand = { ...cmd };
      const channelUsername = cmd.botChannel?.twitchUsername?.toLowerCase();

      if (cmd.regex) {
        try {
          cached.compiledRegex = new RegExp(cmd.regex, "i");
        } catch {
          logger.warn("CommandCache", `Invalid regex for command "${cmd.name}": ${cmd.regex}`);
          continue;
        }

        if (channelUsername) {
          if (!newChannelRegexMaps.has(channelUsername)) {
            newChannelRegexMaps.set(channelUsername, []);
          }
          newChannelRegexMaps.get(channelUsername)!.push(cached);
        } else {
          newGlobalRegexCommands.push(cached);
        }
        continue;
      }

      if (channelUsername) {
        if (!newChannelPrefixMaps.has(channelUsername)) {
          newChannelPrefixMaps.set(channelUsername, new Map());
        }
        const channelMap = newChannelPrefixMaps.get(channelUsername)!;
        channelMap.set(cmd.name.toLowerCase(), cached);
        for (const alias of cmd.aliases) {
          channelMap.set(alias.toLowerCase(), cached);
        }
      } else {
        newGlobalPrefixMap.set(cmd.name.toLowerCase(), cached);
        for (const alias of cmd.aliases) {
          newGlobalPrefixMap.set(alias.toLowerCase(), cached);
        }
      }
    }

    // Atomic swap
    this.channelPrefixMaps = newChannelPrefixMaps;
    this.channelRegexMaps = newChannelRegexMaps;
    this.globalPrefixMap = newGlobalPrefixMap;
    this.globalRegexCommands = newGlobalRegexCommands;

    logger.info("CommandCache", `Loaded ${commands.length} commands across ${newChannelPrefixMaps.size} channels`);
  }

  async reload(): Promise<void> {
    await this.load();
  }

  getByNameOrAlias(name: string, channel?: string): CachedCommand | undefined {
    const key = name.toLowerCase();

    // Check channel-specific first
    if (channel) {
      const channelUsername = stripHash(channel).toLowerCase();
      const channelMap = this.channelPrefixMaps.get(channelUsername);
      if (channelMap) {
        const found = channelMap.get(key);
        if (found) return found;
      }
    }

    // Fall back to global
    return this.globalPrefixMap.get(key);
  }

  getRegexCommands(channel?: string): CachedCommand[] {
    const result: CachedCommand[] = [];

    // Channel-specific regex commands first
    if (channel) {
      const channelUsername = stripHash(channel).toLowerCase();
      const channelRegex = this.channelRegexMaps.get(channelUsername);
      if (channelRegex) {
        result.push(...channelRegex);
      }
    }

    // Then global
    result.push(...this.globalRegexCommands);

    return result;
  }
}

export const commandCache = new CommandCache();
