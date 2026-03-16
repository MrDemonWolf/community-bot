import { relations } from "drizzle-orm";
import { users, sessions, accounts } from "./auth";
import {
  twitchChannels,
  twitchNotifications,
  twitchChatCommands,
  botChannels,
  quotes,
  twitchCounters,
  twitchTimers,
  spamFilters,
  songRequests,
  songRequestSettings,
  defaultCommandOverrides,
  giveaways,
  giveawayEntries,
  playlists,
  playlistEntries,
} from "./twitch";
import { discordGuilds } from "./discord";
import { discordCases, discordCaseNotes } from "./discord-moderation";
import { discordRolePanels, discordRoleButtons } from "./discord-roles";

// ── Auth relations ──────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  botChannel: one(botChannels, {
    fields: [users.id],
    references: [botChannels.userId],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// ── Discord relations ───────────────────────────────────────────────
export const discordGuildsRelations = relations(discordGuilds, ({ many }) => ({
  twitchChannels: many(twitchChannels),
  twitchNotifications: many(twitchNotifications),
}));

export const twitchChannelsRelations = relations(
  twitchChannels,
  ({ one, many }) => ({
    discordGuild: one(discordGuilds, {
      fields: [twitchChannels.guildId],
      references: [discordGuilds.id],
    }),
    twitchNotifications: many(twitchNotifications),
  })
);

export const twitchNotificationsRelations = relations(
  twitchNotifications,
  ({ one }) => ({
    discordGuild: one(discordGuilds, {
      fields: [twitchNotifications.guildId],
      references: [discordGuilds.guildId],
    }),
    twitchChannel: one(twitchChannels, {
      fields: [twitchNotifications.twitchChannelId],
      references: [twitchChannels.id],
    }),
  })
);

// ── BotChannel relations ────────────────────────────────────────────
export const botChannelsRelations = relations(botChannels, ({ one, many }) => ({
  user: one(users, {
    fields: [botChannels.userId],
    references: [users.id],
  }),
  commandOverrides: many(defaultCommandOverrides),
  customCommands: many(twitchChatCommands),
  quotes: many(quotes),
  counters: many(twitchCounters),
  timers: many(twitchTimers),
  spamFilter: one(spamFilters, {
    fields: [botChannels.id],
    references: [spamFilters.botChannelId],
  }),
  songRequests: many(songRequests),
  songRequestSettings: one(songRequestSettings, {
    fields: [botChannels.id],
    references: [songRequestSettings.botChannelId],
  }),
  playlists: many(playlists),
  giveaways: many(giveaways),
}));

// ── Twitch model relations ──────────────────────────────────────────
export const twitchChatCommandsRelations = relations(
  twitchChatCommands,
  ({ one }) => ({
    botChannel: one(botChannels, {
      fields: [twitchChatCommands.botChannelId],
      references: [botChannels.id],
    }),
  })
);

export const quotesRelations = relations(quotes, ({ one }) => ({
  botChannel: one(botChannels, {
    fields: [quotes.botChannelId],
    references: [botChannels.id],
  }),
}));

export const twitchCountersRelations = relations(
  twitchCounters,
  ({ one }) => ({
    botChannel: one(botChannels, {
      fields: [twitchCounters.botChannelId],
      references: [botChannels.id],
    }),
  })
);

export const twitchTimersRelations = relations(twitchTimers, ({ one }) => ({
  botChannel: one(botChannels, {
    fields: [twitchTimers.botChannelId],
    references: [botChannels.id],
  }),
}));

export const spamFiltersRelations = relations(spamFilters, ({ one }) => ({
  botChannel: one(botChannels, {
    fields: [spamFilters.botChannelId],
    references: [botChannels.id],
  }),
}));

export const songRequestsRelations = relations(songRequests, ({ one }) => ({
  botChannel: one(botChannels, {
    fields: [songRequests.botChannelId],
    references: [botChannels.id],
  }),
}));

export const songRequestSettingsRelations = relations(
  songRequestSettings,
  ({ one }) => ({
    botChannel: one(botChannels, {
      fields: [songRequestSettings.botChannelId],
      references: [botChannels.id],
    }),
  })
);

export const defaultCommandOverridesRelations = relations(
  defaultCommandOverrides,
  ({ one }) => ({
    botChannel: one(botChannels, {
      fields: [defaultCommandOverrides.botChannelId],
      references: [botChannels.id],
    }),
  })
);

export const giveawaysRelations = relations(giveaways, ({ one, many }) => ({
  botChannel: one(botChannels, {
    fields: [giveaways.botChannelId],
    references: [botChannels.id],
  }),
  entries: many(giveawayEntries),
}));

export const giveawayEntriesRelations = relations(
  giveawayEntries,
  ({ one }) => ({
    giveaway: one(giveaways, {
      fields: [giveawayEntries.giveawayId],
      references: [giveaways.id],
    }),
  })
);

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  botChannel: one(botChannels, {
    fields: [playlists.botChannelId],
    references: [botChannels.id],
  }),
  entries: many(playlistEntries),
}));

export const playlistEntriesRelations = relations(
  playlistEntries,
  ({ one }) => ({
    playlist: one(playlists, {
      fields: [playlistEntries.playlistId],
      references: [playlists.id],
    }),
  })
);

// ── Discord moderation relations ────────────────────────────────────
export const discordCasesRelations = relations(discordCases, ({ many }) => ({
  notes: many(discordCaseNotes),
}));

export const discordCaseNotesRelations = relations(
  discordCaseNotes,
  ({ one }) => ({
    case: one(discordCases, {
      fields: [discordCaseNotes.caseId],
      references: [discordCases.id],
    }),
  })
);

// ── Discord roles relations ─────────────────────────────────────────
export const discordRolePanelsRelations = relations(
  discordRolePanels,
  ({ many }) => ({
    buttons: many(discordRoleButtons),
  })
);

export const discordRoleButtonsRelations = relations(
  discordRoleButtons,
  ({ one }) => ({
    panel: one(discordRolePanels, {
      fields: [discordRoleButtons.panelId],
      references: [discordRolePanels.id],
    }),
  })
);
