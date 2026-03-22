/**
 * Model type aliases derived from Drizzle schema tables.
 * Usage: import type { User, BotChannel } from "@community-bot/db";
 */
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { users, sessions, accounts, verifications } from "./schema/auth";
import type {
  twitchChannels,
  twitchNotifications,
  twitchCredentials,
  twitchChatCommands,
  regulars,
  botChannels,
  quotes,
  twitchCounters,
  twitchTimers,
  spamFilters,
  spamPermits,
  songRequests,
  songRequestSettings,
  defaultCommandOverrides,
  giveaways,
  giveawayEntries,
  playlists,
  playlistEntries,
  keywords,
  chatAlerts,
  channelPointRewards,
  bannedTracks,
  automodSettings,
} from "./schema/twitch";
import type { discordGuilds } from "./schema/discord";
import type {
  discordCases,
  discordCaseNotes,
  discordWarnThresholds,
} from "./schema/discord-moderation";
import type { discordLogConfigs } from "./schema/discord-logging";
import type {
  discordRolePanels,
  discordRoleButtons,
} from "./schema/discord-roles";
import type { discordCustomCommands } from "./schema/discord-custom-commands";
import type { discordScheduledMessages } from "./schema/discord-scheduled";
import type { discordMessageTemplates } from "./schema/discord-templates";
import type { discordReports } from "./schema/discord-reports";
import type { queueEntries, queueStates } from "./schema/queue";
import type { auditLogs } from "./schema/audit";
import type { systemConfigs } from "./schema/system";

// Auth
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type Account = InferSelectModel<typeof accounts>;
export type Verification = InferSelectModel<typeof verifications>;

// Twitch
export type TwitchChannel = InferSelectModel<typeof twitchChannels>;
export type TwitchNotification = InferSelectModel<typeof twitchNotifications>;
export type TwitchCredential = InferSelectModel<typeof twitchCredentials>;
export type TwitchChatCommand = InferSelectModel<typeof twitchChatCommands>;
export type Regular = InferSelectModel<typeof regulars>;
export type BotChannel = InferSelectModel<typeof botChannels>;
export type Quote = InferSelectModel<typeof quotes>;
export type TwitchCounter = InferSelectModel<typeof twitchCounters>;
export type TwitchTimer = InferSelectModel<typeof twitchTimers>;
export type SpamFilter = InferSelectModel<typeof spamFilters>;
export type SpamPermit = InferSelectModel<typeof spamPermits>;
export type SongRequest = InferSelectModel<typeof songRequests>;
export type SongRequestSettings = InferSelectModel<typeof songRequestSettings>;
export type DefaultCommandOverride = InferSelectModel<typeof defaultCommandOverrides>;
export type Giveaway = InferSelectModel<typeof giveaways>;
export type GiveawayEntry = InferSelectModel<typeof giveawayEntries>;
export type Playlist = InferSelectModel<typeof playlists>;
export type PlaylistEntry = InferSelectModel<typeof playlistEntries>;
export type Keyword = InferSelectModel<typeof keywords>;
export type ChatAlert = InferSelectModel<typeof chatAlerts>;
export type ChannelPointReward = InferSelectModel<typeof channelPointRewards>;
export type BannedTrack = InferSelectModel<typeof bannedTracks>;
export type AutomodSettings = InferSelectModel<typeof automodSettings>;

// Discord
export type DiscordGuild = InferSelectModel<typeof discordGuilds>;
export type DiscordCase = InferSelectModel<typeof discordCases>;
export type DiscordCaseNote = InferSelectModel<typeof discordCaseNotes>;
export type DiscordWarnThreshold = InferSelectModel<typeof discordWarnThresholds>;
export type DiscordLogConfig = InferSelectModel<typeof discordLogConfigs>;
export type DiscordRolePanel = InferSelectModel<typeof discordRolePanels>;
export type DiscordRoleButton = InferSelectModel<typeof discordRoleButtons>;
export type DiscordCustomCommand = InferSelectModel<typeof discordCustomCommands>;
export type DiscordScheduledMessage = InferSelectModel<typeof discordScheduledMessages>;
export type DiscordMessageTemplate = InferSelectModel<typeof discordMessageTemplates>;
export type DiscordReport = InferSelectModel<typeof discordReports>;

// Queue
export type QueueEntry = InferSelectModel<typeof queueEntries>;
export type QueueState = InferSelectModel<typeof queueStates>;

// Audit & System
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type SystemConfig = InferSelectModel<typeof systemConfigs>;

// Enum value types (for type-level use)
// NOTE: UserRole, TwitchAccessLevel, TwitchResponseType, TwitchStreamStatus,
// and QueueStatus type aliases are defined in index.ts alongside their const
// value objects to avoid shadowing conflicts.
export type DiscordCaseType = DiscordCase["type"];
export type DiscordReportStatus = DiscordReport["status"];
export type DiscordScheduleType = DiscordScheduledMessage["type"];
