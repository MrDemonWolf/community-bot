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
  {
    name: "commands",
    description: "Shows link to the public commands list",
    usage: "!commands",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "title",
    description: "Shows the current stream title",
    usage: "!title",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "game",
    description: "Shows the current game/category",
    usage: "!game",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "followage",
    description: "Shows how long you have followed the channel",
    usage: "!followage",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "shoutout",
    description: "Shout out a streamer with their last game info",
    usage: "!so <username>",
    aliases: ["so"],
    accessLevel: "MODERATOR",
  },
  {
    name: "quote",
    description: "View, add, or remove quotes",
    usage: "!quote [number|add <text>|remove <number>]",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "counter",
    description: "Manage named counters",
    usage: "!counter <name> [+|-|set <value>|create|delete]",
    aliases: [],
    accessLevel: "MODERATOR",
  },
  {
    name: "permit",
    description: "Temporarily allow a user to bypass spam filters",
    usage: "!permit <user> [seconds]",
    aliases: [],
    accessLevel: "MODERATOR",
  },
  {
    name: "nuke",
    description: "Timeout all recent users who said a specific word/phrase",
    usage: "!nuke <word/phrase> [seconds]",
    aliases: [],
    accessLevel: "MODERATOR",
  },
  {
    name: "vanish",
    description: "Clear your own messages (self-timeout)",
    usage: "!vanish",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "clip",
    description: "Create a Twitch clip of the current stream",
    usage: "!clip",
    aliases: [],
    accessLevel: "EVERYONE",
  },
  {
    name: "sr",
    description: "Song request queue management",
    usage: "!sr <title> | list | current | skip | clear",
    aliases: ["songrequest", "song"],
    accessLevel: "EVERYONE",
  },
];
