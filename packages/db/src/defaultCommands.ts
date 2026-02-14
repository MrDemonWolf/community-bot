export interface DefaultCommandMeta {
  name: string;
  description: string;
  usage: string;
  aliases: string[];
  accessLevel: "EVERYONE" | "SUBSCRIBER" | "REGULAR" | "VIP" | "MODERATOR" | "LEAD_MODERATOR" | "BROADCASTER";
}

export const DEFAULT_COMMANDS: DefaultCommandMeta[] = [
  {
    name: "ping",
    description: "Replies with Pong!",
    usage: "!ping",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "uptime",
    description: "Shows how long the stream has been live",
    usage: "!uptime",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "accountage",
    description: "Check how old a Twitch account is",
    usage: "!accountage [user]",
    aliases: ["accage", "created"],
    accessLevel: "EVERYONE",
  },
  {
    name: "bot",
    description: "Bot management (mute/unmute)",
    usage: "!bot mute|unmute",
    aliases: [],
    accessLevel: "BROADCASTER",
  },
  {
    name: "queue",
    description: "Manage and join the viewer queue",
    usage: "!queue join|leave|list",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "command",
    description: "Manage chat commands",
    usage: "!command add|edit|remove",
    aliases: [],
    accessLevel: "MODERATOR",
  },
  {
    name: "reloadcommands",
    description: "Reload commands and regulars from DB",
    usage: "!reloadcommands",
    aliases: [],
    accessLevel: "MODERATOR",
  },
  {
    name: "filesay",
    description: "Fetch a text file and send to chat",
    usage: "!filesay <url>",
    aliases: [],
    accessLevel: "BROADCASTER",
  },
];
