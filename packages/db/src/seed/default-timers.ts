/**
 * Default timers seed.
 *
 * Timers fire on intervals while the stream is live (unless `runWhenOffline`).
 * Minimum chat lines since last fire required, to avoid empty-chat spam.
 *
 * Many of these will later be replaced by channel point redeems in
 * Phase 4+. Keeping the prompt copies in seed lets broadcaster restore
 * defaults if a redeem is removed.
 *
 * Tone notes (from Nathanial's SE history):
 *   - Casual and chill, no caps spam.
 *   - "Lurkers welcome" energy.
 *   - Plugs land naturally, never feel pushy.
 *   - Wolf-themed flavor restrained.
 */

export type DefaultTimerSeed = {
  name: string;
  messages: string[];
  intervalSeconds: number;
  minChatLines: number;
  runWhenOffline: boolean;
  enabled: boolean;
  hidden: boolean;
  description: string;
};

export const DEFAULT_TIMERS: DefaultTimerSeed[] = [
  // ────────────────────────────────────────────────────────────────────
  // ENABLED defaults
  // ────────────────────────────────────────────────────────────────────
  {
    name: 'social',
    messages: [
      'Lurking is allowed! If you wanna chat too, drop a hi when you have a sec.',
      'Hop in the Discord for off-stream nonsense: https://mrdwolf.net/discord',
      'Site: https://mrdemonwolf.com — Discord: https://mrdwolf.net/discord',
    ],
    intervalSeconds: 900, // 15 min
    minChatLines: 5,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Social plugs. Rotates message each fire.',
  },
  {
    name: 'lurk-love',
    messages: [
      "Lurkers, you're the real ones. Thanks for hanging.",
      'Background listeners — you count too. Appreciate the company.',
    ],
    intervalSeconds: 1800, // 30 min
    minChatLines: 3,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Lurker appreciation.',
  },
  {
    name: 'follow-prompt',
    messages: [
      'Enjoying the stream? Follow is free and helps a wolf out. 🐺',
      'Smash follow if the vibe is good. Means the world.',
    ],
    intervalSeconds: 1500, // 25 min
    minChatLines: 8,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Follow nudge — minimal pressure.',
  },
  {
    name: 'commands-pointer',
    messages: [
      'Curious what the bot can do? Type !commands or visit the page.',
    ],
    intervalSeconds: 2400, // 40 min
    minChatLines: 10,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Pointer to commands page.',
  },
  {
    name: 'schedule-plug',
    messages: [
      'Schedule lives on the Twitch profile and Discord. Catch you next stream!',
    ],
    intervalSeconds: 3600, // 60 min
    minChatLines: 15,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Schedule plug. Configure via dashboard once Twitch Schedule integration is set.',
  },
  {
    name: 'discord-plug',
    messages: [
      'Off-stream hangs in Discord: https://mrdwolf.net/discord',
      'The Discord is where the post-stream chats happen.',
    ],
    intervalSeconds: 2700, // 45 min
    minChatLines: 6,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Discord plug.',
  },
  {
    name: 'be-kind',
    messages: [
      'Be kind in chat. Disagreement is fine; mean is not.',
      'House rule: bring chill energy. Mods reserve the right to nope.',
    ],
    intervalSeconds: 5400, // 90 min
    minChatLines: 5,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Community vibe reminder.',
  },
  // Skipped: "8" (intentional gap to match Nathanial's SE numbering)
  {
    name: 'no-backseat',
    messages: [
      "Backseating: I love advice when I ask for it. If I haven't asked, let the chaos cook.",
    ],
    intervalSeconds: 4500, // 75 min
    minChatLines: 4,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Backseat policy. Disable for chill puzzle streams.',
  },
  {
    name: 'thanks-for-being-here',
    messages: [
      'Genuinely — thanks for being here. Makes the streams worth doing.',
    ],
    intervalSeconds: 3300, // 55 min
    minChatLines: 8,
    runWhenOffline: false,
    enabled: true,
    hidden: false,
    description: 'Sincere thanks.',
  },

  // ────────────────────────────────────────────────────────────────────
  // SEEDED DISABLED (light on; flip when relevant phase ships)
  // ────────────────────────────────────────────────────────────────────
  {
    name: 'top-brain-cells',
    messages: [
      'Top Brain Cells leaderboard: see it at https://bot.mrdemonwolf.com/brain-cells/top',
    ],
    intervalSeconds: 3600,
    minChatLines: 10,
    runWhenOffline: false,
    enabled: false,
    hidden: true,
    description: 'Top Brain Cells plug. Enable after Phase 4 ships loyalty.',
  },
  {
    name: 'stream-info',
    messages: [
      'Stream info: title via !title, current game via !game, uptime via !uptime.',
    ],
    intervalSeconds: 5400,
    minChatLines: 5,
    runWhenOffline: false,
    enabled: false,
    hidden: true,
    description: 'Stream info pointer. Enable once chat learns the basics.',
  },
  {
    name: 'others-coming-soon',
    messages: [
      'More bot features cooking — Brain Cells, Den access, flows. Stay tuned.',
    ],
    intervalSeconds: 7200, // 2 hr
    minChatLines: 12,
    runWhenOffline: false,
    enabled: false,
    hidden: true,
    description: 'Hype for upcoming features. Enable during build.',
  },
];
