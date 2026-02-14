import consola from "consola";

import { prisma } from "@community-bot/db";
import type { TwitchChatCommand } from "@community-bot/db";

export type CachedCommand = TwitchChatCommand & {
  compiledRegex?: RegExp;
};

class CommandCache {
  private prefixMap = new Map<string, CachedCommand>();
  private regexCommands: CachedCommand[] = [];

  async load(): Promise<void> {
    const commands = await prisma.twitchChatCommand.findMany({
      where: { enabled: true },
    });

    const newPrefixMap = new Map<string, CachedCommand>();
    const newRegexCommands: CachedCommand[] = [];

    for (const cmd of commands) {
      const cached: CachedCommand = { ...cmd };

      if (cmd.regex) {
        try {
          cached.compiledRegex = new RegExp(cmd.regex, "i");
          newRegexCommands.push(cached);
        } catch {
          consola.warn({
            message: `[CommandCache] Invalid regex for command "${cmd.name}": ${cmd.regex}`,
            badge: true,
            timestamp: new Date(),
          });
        }
        continue;
      }

      // Index by name and aliases for O(1) prefix lookup
      newPrefixMap.set(cmd.name.toLowerCase(), cached);
      for (const alias of cmd.aliases) {
        newPrefixMap.set(alias.toLowerCase(), cached);
      }
    }

    // Atomic swap
    this.prefixMap = newPrefixMap;
    this.regexCommands = newRegexCommands;

    consola.info({
      message: `[CommandCache] Loaded ${commands.length} commands (${newPrefixMap.size} prefix entries, ${newRegexCommands.length} regex)`,
      badge: true,
      timestamp: new Date(),
    });
  }

  async reload(): Promise<void> {
    await this.load();
  }

  getByNameOrAlias(name: string): CachedCommand | undefined {
    return this.prefixMap.get(name.toLowerCase());
  }

  getRegexCommands(): CachedCommand[] {
    return this.regexCommands;
  }
}

export const commandCache = new CommandCache();
