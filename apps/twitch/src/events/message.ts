import { ChatClient } from "@twurple/chat";

import { commands } from "../commands/index.js";
import { commandCache, CachedCommand } from "../services/commandCache.js";
import {
  getUserAccessLevel,
  meetsAccessLevel,
} from "../services/accessControl.js";
import { isOnCooldown, recordUsage } from "../services/cooldownManager.js";
import {
  isLive,
  getTitle,
} from "../services/streamStatusManager.js";
import { executeCommand } from "../services/commandExecutor.js";
import { trackMessage } from "../services/chatterTracker.js";
import { isMuted } from "../services/botState.js";
import { TwitchAccessLevel, TwitchStreamStatus } from "@community-bot/db";
import * as commandLogger from "../utils/commandLogger.js";

const COMMAND_PREFIX = "!";

function passesChecks(
  cmd: CachedCommand,
  userLevel: TwitchAccessLevel,
  username: string,
  userId: string
): { pass: boolean; reason?: string } {
  // 1. Access level
  if (!meetsAccessLevel(userLevel, cmd.accessLevel)) {
    return { pass: false, reason: "access_level" };
  }

  // 2. limitToUser
  if (cmd.limitToUser && cmd.limitToUser.toLowerCase() !== username.toLowerCase()) {
    return { pass: false, reason: "limit_to_user" };
  }

  // 3. Stream status
  if (cmd.streamStatus === TwitchStreamStatus.ONLINE && !isLive()) {
    return { pass: false, reason: "stream_offline" };
  }
  if (cmd.streamStatus === TwitchStreamStatus.OFFLINE && isLive()) {
    return { pass: false, reason: "stream_online" };
  }

  // 4. Title keywords
  if (cmd.keywords.length > 0) {
    const title = getTitle().toLowerCase();
    const hasMatch = cmd.keywords.some((kw: string) =>
      title.includes(kw.toLowerCase())
    );
    if (!hasMatch) {
      return { pass: false, reason: "title_keywords" };
    }
  }

  // 5. Cooldowns (mods and broadcasters bypass)
  if (
    userLevel !== TwitchAccessLevel.MODERATOR &&
    userLevel !== TwitchAccessLevel.BROADCASTER
  ) {
    const { onCooldown } = isOnCooldown(
      cmd.name,
      userId,
      cmd.globalCooldown,
      cmd.userCooldown
    );
    if (onCooldown) {
      return { pass: false, reason: "cooldown" };
    }
  }

  return { pass: true };
}

export function registerMessageEvents(chatClient: ChatClient): void {
  chatClient.onMessage((channel, user, text, msg) => {
    trackMessage(channel, user);

    // When muted, only allow "!bot unmute" through
    if (isMuted()) {
      const trimmed = text.trim().toLowerCase();
      if (trimmed !== "!bot unmute") return;
    }

    // Phase 1: Built-in prefix commands (highest priority)
    if (text.startsWith(COMMAND_PREFIX)) {
      const args = text.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const builtIn = commands.get(commandName);
      if (builtIn) {
        commandLogger.info(builtIn.name, user, msg.userInfo.userId);
        builtIn
          .execute(chatClient, channel, user, args, msg)
          .then(() => {
            commandLogger.success(builtIn.name, user, msg.userInfo.userId);
          })
          .catch(() => {
            commandLogger.error(builtIn.name, user, msg.userInfo.userId);
          });
        return;
      }

      // Phase 2: DB prefix commands
      const dbCmd = commandCache.getByNameOrAlias(commandName);
      if (dbCmd) {
        const userLevel = getUserAccessLevel(msg);
        const check = passesChecks(dbCmd, userLevel, user, msg.userInfo.userId);
        if (!check.pass) return;

        recordUsage(
          dbCmd.name,
          msg.userInfo.userId,
          dbCmd.globalCooldown,
          dbCmd.userCooldown
        );

        commandLogger.info(dbCmd.name, user, msg.userInfo.userId);
        executeCommand(
          chatClient,
          channel,
          user,
          args,
          msg,
          dbCmd.response,
          dbCmd.responseType
        )
          .then(() => {
            commandLogger.success(dbCmd.name, user, msg.userInfo.userId);
          })
          .catch(() => {
            commandLogger.error(dbCmd.name, user, msg.userInfo.userId);
          });
        return;
      }
    }

    // Phase 3: DB regex commands
    const regexCommands = commandCache.getRegexCommands();
    for (const cmd of regexCommands) {
      if (!cmd.compiledRegex) continue;
      if (!cmd.compiledRegex.test(text)) continue;

      const userLevel = getUserAccessLevel(msg);
      const check = passesChecks(cmd, userLevel, user, msg.userInfo.userId);
      if (!check.pass) continue;

      recordUsage(
        cmd.name,
        msg.userInfo.userId,
        cmd.globalCooldown,
        cmd.userCooldown
      );

      const args = text.split(/\s+/);
      commandLogger.info(cmd.name, user, msg.userInfo.userId);
      executeCommand(
        chatClient,
        channel,
        user,
        args,
        msg,
        cmd.response,
        cmd.responseType
      )
        .then(() => {
          commandLogger.success(cmd.name, user, msg.userInfo.userId);
        })
        .catch(() => {
          commandLogger.error(cmd.name, user, msg.userInfo.userId);
        });
      return; // First match wins
    }
  });
}
