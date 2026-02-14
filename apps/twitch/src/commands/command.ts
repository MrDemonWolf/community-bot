import {
  Prisma,
  TwitchAccessLevel,
  TwitchResponseType,
  TwitchStreamStatus,
} from "@community-bot/db";
import { TwitchCommand } from "../types/command.js";
import { prisma } from "@community-bot/db";
import { commandCache } from "../services/commandCache.js";
import { commands } from "./index.js";

// Names that cannot be used for DB commands
function isBuiltInName(name: string): boolean {
  return commands.has(name.toLowerCase());
}

function stripBang(name: string): string {
  return name.startsWith("!") ? name.slice(1) : name;
}

function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}

async function getBotChannelId(channel: string): Promise<string | null> {
  const username = stripHash(channel).toLowerCase();
  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: username },
  });
  return botChannel?.id ?? null;
}

const VALID_ACCESS_LEVELS: Record<string, TwitchAccessLevel> = {
  everyone: TwitchAccessLevel.EVERYONE,
  subscriber: TwitchAccessLevel.SUBSCRIBER,
  regular: TwitchAccessLevel.REGULAR,
  vip: TwitchAccessLevel.VIP,
  moderator: TwitchAccessLevel.MODERATOR,
  broadcaster: TwitchAccessLevel.BROADCASTER,
};

const VALID_RESPONSE_TYPES: Record<string, TwitchResponseType> = {
  say: TwitchResponseType.SAY,
  mention: TwitchResponseType.MENTION,
  reply: TwitchResponseType.REPLY,
};

const VALID_STREAM_STATUSES: Record<string, TwitchStreamStatus> = {
  online: TwitchStreamStatus.ONLINE,
  offline: TwitchStreamStatus.OFFLINE,
  both: TwitchStreamStatus.BOTH,
};

// ── Subcommand handlers ──

async function handleAdd(
  say: (text: string) => Promise<void>,
  user: string,
  args: string[],
  botChannelId: string
): Promise<void> {
  if (args.length < 2) {
    await say(`@${user} Usage: !command add <name> <response>`);
    return;
  }

  const name = stripBang(args[0]).toLowerCase();
  const response = args.slice(1).join(" ");

  if (isBuiltInName(name)) {
    await say(`@${user} "${name}" is a built-in command and cannot be added.`);
    return;
  }

  try {
    await prisma.twitchChatCommand.create({
      data: { name, response, botChannelId },
    });
    await commandCache.reload();
    await say(`@${user} Command !${name} has been added.`);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await say(`@${user} Command !${name} already exists.`);
    } else {
      throw err;
    }
  }
}

async function handleEdit(
  say: (text: string) => Promise<void>,
  user: string,
  args: string[],
  botChannelId: string
): Promise<void> {
  if (args.length < 2) {
    await say(`@${user} Usage: !command edit <name> <response>`);
    return;
  }

  const name = stripBang(args[0]).toLowerCase();
  const response = args.slice(1).join(" ");

  try {
    await prisma.twitchChatCommand.update({
      where: { name_botChannelId: { name, botChannelId } },
      data: { response },
    });
    await commandCache.reload();
    await say(`@${user} Command !${name} has been updated.`);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      await say(`@${user} Command !${name} does not exist.`);
    } else {
      throw err;
    }
  }
}

async function handleRemove(
  say: (text: string) => Promise<void>,
  user: string,
  args: string[],
  botChannelId: string
): Promise<void> {
  if (args.length < 1) {
    await say(`@${user} Usage: !command remove <name>`);
    return;
  }

  const name = stripBang(args[0]).toLowerCase();

  try {
    await prisma.twitchChatCommand.delete({
      where: { name_botChannelId: { name, botChannelId } },
    });
    await commandCache.reload();
    await say(`@${user} Command !${name} has been removed.`);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      await say(`@${user} Command !${name} does not exist.`);
    } else {
      throw err;
    }
  }
}

async function handleShow(
  say: (text: string) => Promise<void>,
  user: string,
  args: string[],
  botChannelId: string
): Promise<void> {
  if (args.length < 1) {
    await say(`@${user} Usage: !command show <name>`);
    return;
  }

  const name = stripBang(args[0]).toLowerCase();

  const cmd = await prisma.twitchChatCommand.findUnique({
    where: { name_botChannelId: { name, botChannelId } },
  });
  if (!cmd) {
    await say(`@${user} Command !${name} does not exist.`);
    return;
  }

  const parts: string[] = [
    `!${cmd.name}`,
    `[${cmd.enabled ? "enabled" : "disabled"}]`,
    `type:${cmd.responseType.toLowerCase()}`,
    `level:${cmd.accessLevel.toLowerCase()}`,
    `cd:${cmd.globalCooldown}s`,
    `usercd:${cmd.userCooldown}s`,
  ];

  if (cmd.aliases.length > 0) {
    parts.push(`aliases:${cmd.aliases.join(",")}`);
  }
  if (cmd.hidden) {
    parts.push("hidden");
  }
  if (cmd.streamStatus !== TwitchStreamStatus.BOTH) {
    parts.push(`stream:${cmd.streamStatus.toLowerCase()}`);
  }
  if (cmd.limitToUser) {
    parts.push(`limituser:${cmd.limitToUser}`);
  }

  parts.push(`| ${cmd.response}`);

  await say(`@${user} ${parts.join(" ")}`);
}

async function handleOptions(
  say: (text: string) => Promise<void>,
  user: string,
  args: string[],
  botChannelId: string
): Promise<void> {
  if (args.length < 2) {
    await say(
      `@${user} Usage: !command options <name> <flags...> (flags: -cd, -usercd, -level, -type, -enable, -disable, -alias, -hidden, -visible, -stream, -limituser)`
    );
    return;
  }

  const name = stripBang(args[0]).toLowerCase();

  // Check command exists
  const existing = await prisma.twitchChatCommand.findUnique({
    where: { name_botChannelId: { name, botChannelId } },
  });
  if (!existing) {
    await say(`@${user} Command !${name} does not exist.`);
    return;
  }

  const data: Prisma.TwitchChatCommandUpdateInput = {};
  const errors: string[] = [];
  let i = 1;

  while (i < args.length) {
    const flag = args[i].toLowerCase();

    switch (flag) {
      case "-cd": {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 0) {
          errors.push("-cd requires a non-negative number");
        } else {
          data.globalCooldown = val;
        }
        break;
      }

      case "-usercd": {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 0) {
          errors.push("-usercd requires a non-negative number");
        } else {
          data.userCooldown = val;
        }
        break;
      }

      case "-level": {
        const val = args[++i]?.toLowerCase();
        const level = VALID_ACCESS_LEVELS[val];
        if (!level) {
          errors.push(
            `-level must be one of: ${Object.keys(VALID_ACCESS_LEVELS).join(", ")}`
          );
        } else {
          data.accessLevel = level;
        }
        break;
      }

      case "-type": {
        const val = args[++i]?.toLowerCase();
        const type = VALID_RESPONSE_TYPES[val];
        if (!type) {
          errors.push(
            `-type must be one of: ${Object.keys(VALID_RESPONSE_TYPES).join(", ")}`
          );
        } else {
          data.responseType = type;
        }
        break;
      }

      case "-enable":
        data.enabled = true;
        break;

      case "-disable":
        data.enabled = false;
        break;

      case "-hidden":
        data.hidden = true;
        break;

      case "-visible":
        data.hidden = false;
        break;

      case "-stream": {
        const val = args[++i]?.toLowerCase();
        const status = VALID_STREAM_STATUSES[val];
        if (!status) {
          errors.push(
            `-stream must be one of: ${Object.keys(VALID_STREAM_STATUSES).join(", ")}`
          );
        } else {
          data.streamStatus = status;
        }
        break;
      }

      case "-limituser": {
        const val = args[++i];
        if (!val) {
          errors.push("-limituser requires a username or 'clear'");
        } else if (val.toLowerCase() === "clear") {
          data.limitToUser = null;
        } else {
          data.limitToUser = val.toLowerCase();
        }
        break;
      }

      case "-alias": {
        const action = args[++i]?.toLowerCase();
        const aliasName = args[++i]?.toLowerCase();

        if (!action || !aliasName || (action !== "add" && action !== "remove")) {
          errors.push("-alias usage: -alias add <name> or -alias remove <name>");
        } else {
          const currentAliases = existing.aliases;
          if (action === "add") {
            if (isBuiltInName(aliasName)) {
              errors.push(`"${aliasName}" is a built-in command and cannot be used as an alias`);
            } else if (currentAliases.includes(aliasName)) {
              errors.push(`Alias "${aliasName}" already exists on !${name}`);
            } else {
              data.aliases = [...currentAliases, aliasName];
            }
          } else {
            if (!currentAliases.includes(aliasName)) {
              errors.push(`Alias "${aliasName}" does not exist on !${name}`);
            } else {
              data.aliases = currentAliases.filter((a) => a !== aliasName);
            }
          }
        }
        break;
      }

      default:
        errors.push(`Unknown flag: ${flag}`);
        break;
    }

    i++;
  }

  if (errors.length > 0) {
    await say(`@${user} Errors: ${errors.join("; ")}`);
    return;
  }

  if (Object.keys(data).length === 0) {
    await say(`@${user} No valid options provided.`);
    return;
  }

  await prisma.twitchChatCommand.update({
    where: { name_botChannelId: { name, botChannelId } },
    data,
  });
  await commandCache.reload();
  await say(`@${user} Options for !${name} have been updated.`);
}

// ── Main command ──

export const command: TwitchCommand = {
  name: "command",
  description: "Manage chat commands (mod/broadcaster only)",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isMod && !msg.userInfo.isBroadcaster) {
      return;
    }

    const say = (text: string) => client.say(channel, text);
    const subcommand = args[0]?.toLowerCase();
    const botChannelId = await getBotChannelId(channel);

    if (!botChannelId) {
      await say(`@${user} Bot channel not configured for this channel.`);
      return;
    }

    switch (subcommand) {
      case "add":
        await handleAdd(say, user, args.slice(1), botChannelId);
        break;
      case "edit":
        await handleEdit(say, user, args.slice(1), botChannelId);
        break;
      case "remove":
      case "delete":
        await handleRemove(say, user, args.slice(1), botChannelId);
        break;
      case "show":
        await handleShow(say, user, args.slice(1), botChannelId);
        break;
      case "options":
        await handleOptions(say, user, args.slice(1), botChannelId);
        break;
      default:
        await say(
          `@${user} Usage: !command <add|edit|remove|show|options> ...`
        );
        break;
    }
  },
};
