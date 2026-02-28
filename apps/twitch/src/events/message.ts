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
import { getBroadcasterId } from "../services/broadcasterCache.js";
import { isMuted } from "../services/botState.js";
import { checkMessage, handleViolation } from "../services/spamFilter.js";
import {
  isCommandDisabled,
  getAccessLevelOverride,
} from "../services/disabledCommandsCache.js";
import { TwitchAccessLevel, TwitchStreamStatus } from "@community-bot/db";
import { logger } from "../utils/logger.js";

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
    userLevel !== TwitchAccessLevel.LEAD_MODERATOR &&
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
    trackMessage(channel, user, text);

    // When muted for this channel, only allow "!bot unmute" through
    if (isMuted(channel)) {
      const trimmed = text.trim().toLowerCase();
      if (trimmed !== "!bot unmute") return;
    }

    // Spam filter check — runs before command dispatch
    checkMessage(channel, user, text, msg)
      .then((violation) => {
        if (violation) {
          handleViolation(chatClient, channel, user, violation);
        }
      })
      .catch(() => {
        // Silently ignore spam filter errors to not block message flow
      });

    // Phase 1: Built-in prefix commands (highest priority)
    if (text.startsWith(COMMAND_PREFIX)) {
      const args = text.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const builtIn = commands.get(commandName);
      if (builtIn) {
        // Check if this built-in command is disabled for this channel
        if (isCommandDisabled(channel, builtIn.name)) {
          return;
        }

        // Check per-channel access level override
        const accessOverride = getAccessLevelOverride(channel, builtIn.name);
        if (accessOverride) {
          const userLevel = getUserAccessLevel(msg);
          if (!meetsAccessLevel(userLevel, accessOverride as TwitchAccessLevel)) {
            return;
          }
        }

        logger.commands.executing(builtIn.name, user, msg.userInfo.userId);
        builtIn
          .execute(chatClient, channel, user, args, msg)
          .then(() => {
            logger.commands.success(builtIn.name, user, msg.userInfo.userId);
          })
          .catch(() => {
            logger.commands.error(builtIn.name, user, msg.userInfo.userId);
          });
        return;
      }

      // Phase 2: DB prefix commands
      const dbCmd = commandCache.getByNameOrAlias(commandName, channel);
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

        logger.commands.executing(dbCmd.name, user, msg.userInfo.userId);
        executeCommand(
          chatClient,
          channel,
          user,
          args,
          msg,
          dbCmd.response,
          dbCmd.responseType,
          dbCmd.id,
          getBroadcasterId(channel)
        )
          .then(() => {
            logger.commands.success(dbCmd.name, user, msg.userInfo.userId);
          })
          .catch(() => {
            logger.commands.error(dbCmd.name, user, msg.userInfo.userId);
          });
        return;
      }
    }

    // Phase 3: DB regex commands
    const regexCommands = commandCache.getRegexCommands(channel);
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
      logger.commands.executing(cmd.name, user, msg.userInfo.userId);
      executeCommand(
        chatClient,
        channel,
        user,
        args,
        msg,
        cmd.response,
        cmd.responseType,
        cmd.id,
        getBroadcasterId(channel)
      )
        .then(() => {
          logger.commands.success(cmd.name, user, msg.userInfo.userId);
        })
        .catch(() => {
          logger.commands.error(cmd.name, user, msg.userInfo.userId);
        });
      return; // First match wins
    }
  });
}
