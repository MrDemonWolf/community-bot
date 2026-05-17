/**
 * Default commands seed for community-bot.
 *
 * - The 12 MVP commands ship `enabled: true, hidden: false`.
 * - The 16 "Later" commands ship `enabled: false, hidden: true`.
 *   Broadcaster can flip both flags in the dashboard once the relevant
 *   phase ships the underlying engine. Hidden commands DO NOT appear on
 *   the public commands page.
 *
 * Roles enum: 'broadcaster' | 'editor' | 'moderator' | 'vip' | 'subscriber' | 'viewer'
 *
 * Permission semantics: `minRole` is the LOWEST role that may invoke.
 * Cooldowns are in seconds. `globalCooldown` blocks everyone; `userCooldown`
 * blocks the individual caller. Use 0 to disable.
 */

export type DefaultCommandSeed = {
  name: string; // without prefix
  response: string | null; // null means "built-in handler dispatches"
  builtin: string | null; // name of built-in handler if any
  minRole: "broadcaster" | "editor" | "moderator" | "vip" | "subscriber" | "viewer";
  globalCooldown: number;
  userCooldown: number;
  enabled: boolean;
  hidden: boolean;
  description: string;
  phase: number | string; // which phase ships the engine
};

export const DEFAULT_COMMANDS: DefaultCommandSeed[] = [
  // ────────────────────────────────────────────────────────────────────
  // MVP (Phase 2) — enabled, public
  // ────────────────────────────────────────────────────────────────────
  {
    name: "uptime",
    response: null,
    builtin: "uptime",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 15,
    enabled: true,
    hidden: false,
    description: "Shows current stream uptime, or notes stream is offline.",
    phase: 2,
  },
  {
    name: "followage",
    response: null,
    builtin: "followage",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 30,
    enabled: true,
    hidden: false,
    description: "How long the caller (or argument target) has followed.",
    phase: 2,
  },
  {
    name: "accountage",
    response: null,
    builtin: "accountage",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 30,
    enabled: true,
    hidden: false,
    description: "Twitch account age of caller or argument target.",
    phase: 2,
  },
  {
    name: "game",
    response: null,
    builtin: "game-read",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 15,
    enabled: true,
    hidden: false,
    description: "Current Twitch category.",
    phase: 2,
  },
  {
    name: "title",
    response: null,
    builtin: "title-read",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 15,
    enabled: true,
    hidden: false,
    description: "Current Twitch stream title.",
    phase: 2,
  },
  {
    name: "commands",
    response: "Full command list: https://bot.mrdemonwolf.com/commands",
    builtin: null,
    minRole: "viewer",
    globalCooldown: 30,
    userCooldown: 60,
    enabled: true,
    hidden: false,
    description: "Links to public commands page.",
    phase: 2,
  },
  {
    name: "addcom",
    response: null,
    builtin: "addcom",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: true,
    hidden: false,
    description: "Add a custom command. Usage: !addcom !name response text",
    phase: 2,
  },
  {
    name: "editcom",
    response: null,
    builtin: "editcom",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: true,
    hidden: false,
    description: "Edit an existing custom command.",
    phase: 2,
  },
  {
    name: "delcom",
    response: null,
    builtin: "delcom",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: true,
    hidden: false,
    description: "Soft-delete a custom command.",
    phase: 2,
  },
  {
    name: "marker",
    response: null,
    builtin: "marker",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 10,
    enabled: true,
    hidden: false,
    description: "Create a Twitch stream marker with optional description.",
    phase: 2,
  },
  {
    name: "clip",
    response: null,
    builtin: "clip",
    minRole: "moderator",
    globalCooldown: 30,
    userCooldown: 60,
    enabled: true,
    hidden: false,
    description: "Create a 30-second Twitch clip.",
    phase: 2,
  },
  {
    name: "commercial",
    response: null,
    builtin: "commercial",
    minRole: "broadcaster",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: true,
    hidden: false,
    description: "Run a commercial (30/60/90/120/150/180 seconds). Broadcaster only.",
    phase: 2,
  },
  {
    name: "vanish",
    response: null,
    builtin: "vanish",
    minRole: "viewer",
    globalCooldown: 0,
    userCooldown: 60,
    enabled: true,
    hidden: false,
    description: "Self-purge: bot 1-second-timeouts the caller to clear their chat.",
    phase: 2,
  },
  {
    name: "ping",
    response: null,
    builtin: "ping",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 5,
    enabled: true,
    hidden: false,
    description: 'Health check. Replies "pong".',
    phase: 2,
  },

  // ────────────────────────────────────────────────────────────────────
  // Later (seeded disabled + hidden — flip on once the relevant phase ships)
  // ────────────────────────────────────────────────────────────────────

  // Shoutout — Phase 4 manual / Phase 8 AI
  {
    name: "so",
    response: null,
    builtin: "shoutout",
    minRole: "moderator",
    globalCooldown: 10,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Shoutout a user. AI-augmented version ships Phase 8.",
    phase: "4 / 8",
  },

  // Loyalty (Brain Cells) — Phase 4
  {
    name: "points",
    response: null,
    builtin: "points-read",
    minRole: "viewer",
    globalCooldown: 0,
    userCooldown: 30,
    enabled: false,
    hidden: true,
    description: "Show caller Brain Cells balance.",
    phase: 4,
  },
  {
    name: "top",
    response: null,
    builtin: "points-top",
    minRole: "viewer",
    globalCooldown: 60,
    userCooldown: 60,
    enabled: false,
    hidden: true,
    description: "Top 10 Brain Cell holders.",
    phase: 4,
  },
  {
    name: "addpoints",
    response: null,
    builtin: "points-add",
    minRole: "broadcaster",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Add Brain Cells to a user. Broadcaster only.",
    phase: 4,
  },
  {
    name: "removepoints",
    response: null,
    builtin: "points-remove",
    minRole: "broadcaster",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Remove Brain Cells from a user. Broadcaster only.",
    phase: 4,
  },
  {
    name: "givepoints",
    response: null,
    builtin: "points-give",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 60,
    enabled: false,
    hidden: true,
    description: "Transfer Brain Cells viewer-to-viewer (toggleable; default off).",
    phase: 4,
  },

  // Quotes — post-MVP feature
  {
    name: "quote",
    response: null,
    builtin: "quote-read",
    minRole: "viewer",
    globalCooldown: 10,
    userCooldown: 30,
    enabled: false,
    hidden: true,
    description: "Random quote, or specific quote by ID.",
    phase: "post-MVP",
  },
  {
    name: "addquote",
    response: null,
    builtin: "quote-add",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Add a quote.",
    phase: "post-MVP",
  },
  {
    name: "delquote",
    response: null,
    builtin: "quote-del",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Delete a quote by ID.",
    phase: "post-MVP",
  },
  {
    name: "quotesearch",
    response: null,
    builtin: "quote-search",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 30,
    enabled: false,
    hidden: true,
    description: "Search quote DB by substring.",
    phase: "post-MVP",
  },

  // Counters
  {
    name: "count",
    response: null,
    builtin: "count-read",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 15,
    enabled: false,
    hidden: true,
    description: "Read a named counter. Usage: !count <name>",
    phase: "post-MVP",
  },
  {
    name: "resetcount",
    response: null,
    builtin: "count-reset",
    minRole: "broadcaster",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Reset a named counter.",
    phase: "post-MVP",
  },

  // Fun
  {
    name: "8ball",
    response: null,
    builtin: "8ball",
    minRole: "viewer",
    globalCooldown: 5,
    userCooldown: 30,
    enabled: false,
    hidden: true,
    description: "Classic magic 8-ball.",
    phase: "post-MVP",
  },
  {
    name: "roll",
    response: null,
    builtin: "roll",
    minRole: "viewer",
    globalCooldown: 3,
    userCooldown: 15,
    enabled: false,
    hidden: true,
    description: "Roll dice. Usage: !roll 2d6 or !roll 100",
    phase: "post-MVP",
  },
  {
    name: "flip",
    response: null,
    builtin: "flip",
    minRole: "viewer",
    globalCooldown: 3,
    userCooldown: 15,
    enabled: false,
    hidden: true,
    description: "Coin flip.",
    phase: "post-MVP",
  },
  {
    name: "dadjoke",
    response: null,
    builtin: "dadjoke",
    minRole: "viewer",
    globalCooldown: 30,
    userCooldown: 60,
    enabled: false,
    hidden: true,
    description: "Random dad joke (icanhazdadjoke API or local list).",
    phase: "post-MVP",
  },
  {
    name: "fact",
    response: null,
    builtin: "fact",
    minRole: "viewer",
    globalCooldown: 30,
    userCooldown: 60,
    enabled: false,
    hidden: true,
    description: "Random fact from local fact pool.",
    phase: "post-MVP",
  },

  // Mod QoL
  {
    name: "permit",
    response: null,
    builtin: "permit",
    minRole: "moderator",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description: "Permit a user to post links once (60s window).",
    phase: 3,
  },

  // SETTER versions (NOT shipping in Phase 2 — read-only versions ship)
  {
    name: "title-set",
    response: null,
    builtin: "title-set",
    minRole: "editor",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description:
      "Set stream title. Usage: !title <new title>. SET version deferred per architecture decision. Disambiguated from read version at command runtime via arg presence.",
    phase: "post-MVP",
  },
  {
    name: "game-set",
    response: null,
    builtin: "game-set",
    minRole: "editor",
    globalCooldown: 0,
    userCooldown: 0,
    enabled: false,
    hidden: true,
    description:
      "Set stream category. Usage: !game <new category>. SET version deferred per architecture decision.",
    phase: "post-MVP",
  },

  // Integrations
  {
    name: "weather",
    response: null,
    builtin: "weather",
    minRole: "viewer",
    globalCooldown: 30,
    userCooldown: 60,
    enabled: false,
    hidden: true,
    description: "Weather lookup via Apple WeatherKit. Usage: !weather <city>",
    phase: "post-MVP",
  },
  {
    name: "dictionary",
    response: null,
    builtin: "dictionary",
    minRole: "viewer",
    globalCooldown: 10,
    userCooldown: 30,
    enabled: false,
    hidden: true,
    description: "Dictionary lookup via dictionaryapi.dev (free, no auth).",
    phase: "post-MVP",
  },
  {
    name: "song",
    response: null,
    builtin: "song",
    minRole: "viewer",
    globalCooldown: 10,
    userCooldown: 30,
    enabled: false,
    hidden: true,
    description: "Currently playing track. Wires into WolfWave in Phase 13.",
    phase: 13,
  },
  {
    name: "bot",
    response: "community-bot ${botVersion} — open source at ${repoUrl}",
    builtin: null,
    minRole: "viewer",
    globalCooldown: 30,
    userCooldown: 60,
    enabled: false,
    hidden: true,
    description: "About this bot.",
    phase: "post-MVP",
  },
];

/**
 * Commands explicitly NOT seeded. If a future phase wants any of these,
 * make a deliberate decision and add to seed at that time. Listing here
 * for completeness and to prevent accidental re-implementation.
 */
export const EXPLICITLY_NOT_SEEDED = [
  "followers", // Twitch deprecated public follower list
  "lastseen", // privacy concerns
  "emotes", // duplicates Twitch native
  "items", // SE legacy currency thing
  "duel", // PvP point-betting; not in scope
  "accept", // partner of duel
  "filesay", // exec command from text file; security smell
  "urbandictionary", // content quality + brand fit
  "votekick", // grief vector; mod-only decisions only
] as const;
