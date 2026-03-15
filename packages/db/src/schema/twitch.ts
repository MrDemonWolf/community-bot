import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const twitchResponseTypeEnum = pgEnum("TwitchResponseType", [
  "SAY",
  "MENTION",
  "REPLY",
]);

export const twitchAccessLevelEnum = pgEnum("TwitchAccessLevel", [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
]);

export const twitchStreamStatusEnum = pgEnum("TwitchStreamStatus", [
  "ONLINE",
  "OFFLINE",
  "BOTH",
]);

export const twitchChannels = pgTable(
  "TwitchChannel",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    twitchChannelId: text("twitchChannelId").notNull(),
    username: text("username"),
    displayName: text("displayName"),
    profileImageUrl: text("profileImageUrl"),
    isLive: boolean("isLive").notNull().default(false),
    lastStreamTitle: text("lastStreamTitle"),
    lastGameName: text("lastGameName"),
    lastStartedAt: timestamp("lastStartedAt"),
    guildId: text("guildId"),
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
    notificationChannelId: text("notificationChannelId"),
    notificationRoleId: text("notificationRoleId"),
    updateMessageLive: boolean("updateMessageLive").notNull().default(true),
    deleteWhenOffline: boolean("deleteWhenOffline").notNull().default(false),
    autoPublish: boolean("autoPublish").notNull().default(false),
    useCustomMessage: boolean("useCustomMessage").notNull().default(false),
    customOnlineMessage: text("customOnlineMessage"),
    customOfflineMessage: text("customOfflineMessage"),
  },
  (t) => [
    unique("TwitchChannel_twitchChannelId_guildId_key").on(
      t.twitchChannelId,
      t.guildId
    ),
  ]
);

export const twitchNotifications = pgTable("TwitchNotification", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  messageId: text("messageId").notNull(),
  channelId: text("channelId").notNull(),
  guildId: text("guildId").notNull(),
  twitchChannelId: text("twitchChannelId").notNull(),
  isLive: boolean("isLive").notNull().default(true),
  streamStartedAt: timestamp("streamStartedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const twitchCredentials = pgTable("TwitchCredential", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  expiresIn: integer("expiresIn").notNull(),
  obtainmentTimestamp: bigint("obtainmentTimestamp", { mode: "bigint" }).notNull(),
  scope: text("scope")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const twitchChatCommands = pgTable(
  "TwitchChatCommand",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    response: text("response").notNull(),
    responseType: twitchResponseTypeEnum("responseType")
      .notNull()
      .default("SAY"),
    globalCooldown: integer("globalCooldown").notNull().default(0),
    userCooldown: integer("userCooldown").notNull().default(0),
    accessLevel: twitchAccessLevelEnum("accessLevel")
      .notNull()
      .default("EVERYONE"),
    limitToUser: text("limitToUser"),
    streamStatus: twitchStreamStatusEnum("streamStatus")
      .notNull()
      .default("BOTH"),
    hidden: boolean("hidden").notNull().default(false),
    aliases: text("aliases")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    regex: text("regex"),
    useCount: integer("useCount").notNull().default(0),
    expiresAt: timestamp("expiresAt"),
    botChannelId: text("botChannelId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("TwitchChatCommand_name_botChannelId_key").on(
      t.name,
      t.botChannelId
    ),
  ]
);

export const regulars = pgTable("Regular", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  twitchUserId: text("twitchUserId").unique(),
  twitchUsername: text("twitchUsername"),
  discordUserId: text("discordUserId").unique(),
  discordUsername: text("discordUsername"),
  addedBy: text("addedBy").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const botChannels = pgTable("BotChannel", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().unique(),
  twitchUsername: text("twitchUsername").notNull(),
  twitchUserId: text("twitchUserId").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  muted: boolean("muted").notNull().default(false),
  aiShoutoutEnabled: boolean("aiShoutoutEnabled").notNull().default(false),
  disabledCommands: text("disabledCommands")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const quotes = pgTable(
  "Quote",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quoteNumber: integer("quoteNumber").notNull(),
    text: text("text").notNull(),
    game: text("game"),
    addedBy: text("addedBy").notNull(),
    source: text("source").notNull().default("twitch"),
    botChannelId: text("botChannelId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    unique("Quote_quoteNumber_botChannelId_key").on(
      t.quoteNumber,
      t.botChannelId
    ),
  ]
);

export const twitchCounters = pgTable(
  "TwitchCounter",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    value: integer("value").notNull().default(0),
    botChannelId: text("botChannelId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("TwitchCounter_name_botChannelId_key").on(t.name, t.botChannelId),
  ]
);

export const twitchTimers = pgTable(
  "TwitchTimer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    message: text("message").notNull(),
    intervalMinutes: integer("intervalMinutes").notNull().default(5),
    chatLines: integer("chatLines").notNull().default(0),
    botChannelId: text("botChannelId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("TwitchTimer_name_botChannelId_key").on(t.name, t.botChannelId),
  ]
);

export const spamFilters = pgTable("SpamFilter", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botChannelId: text("botChannelId").notNull().unique(),
  capsEnabled: boolean("capsEnabled").notNull().default(false),
  capsMinLength: integer("capsMinLength").notNull().default(15),
  capsMaxPercent: integer("capsMaxPercent").notNull().default(70),
  linksEnabled: boolean("linksEnabled").notNull().default(false),
  linksAllowSubs: boolean("linksAllowSubs").notNull().default(true),
  symbolsEnabled: boolean("symbolsEnabled").notNull().default(false),
  symbolsMaxPercent: integer("symbolsMaxPercent").notNull().default(50),
  emotesEnabled: boolean("emotesEnabled").notNull().default(false),
  emotesMaxCount: integer("emotesMaxCount").notNull().default(15),
  repetitionEnabled: boolean("repetitionEnabled").notNull().default(false),
  repetitionMaxRepeat: integer("repetitionMaxRepeat").notNull().default(10),
  bannedWordsEnabled: boolean("bannedWordsEnabled").notNull().default(false),
  bannedWords: text("bannedWords")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  exemptLevel: twitchAccessLevelEnum("exemptLevel")
    .notNull()
    .default("SUBSCRIBER"),
  timeoutDuration: integer("timeoutDuration").notNull().default(5),
  warningMessage: text("warningMessage")
    .notNull()
    .default("Please don't spam."),
});

export const spamPermits = pgTable(
  "SpamPermit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    username: text("username").notNull(),
    botChannelId: text("botChannelId").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    index("SpamPermit_username_botChannelId_idx").on(
      t.username,
      t.botChannelId
    ),
  ]
);

export const songRequests = pgTable(
  "SongRequest",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    requestedBy: text("requestedBy").notNull(),
    youtubeVideoId: text("youtubeVideoId"),
    youtubeDuration: integer("youtubeDuration"),
    youtubeThumbnail: text("youtubeThumbnail"),
    youtubeChannel: text("youtubeChannel"),
    source: text("source").notNull().default("viewer"),
    botChannelId: text("botChannelId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    index("SongRequest_botChannelId_position_idx").on(
      t.botChannelId,
      t.position
    ),
  ]
);

export const songRequestSettings = pgTable("SongRequestSettings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botChannelId: text("botChannelId").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  maxQueueSize: integer("maxQueueSize").notNull().default(50),
  maxPerUser: integer("maxPerUser").notNull().default(5),
  minAccessLevel: twitchAccessLevelEnum("minAccessLevel")
    .notNull()
    .default("EVERYONE"),
  maxDuration: integer("maxDuration"),
  autoPlayEnabled: boolean("autoPlayEnabled").notNull().default(false),
  activePlaylistId: text("activePlaylistId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const defaultCommandOverrides = pgTable(
  "DefaultCommandOverride",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    botChannelId: text("botChannelId").notNull(),
    commandName: text("commandName").notNull(),
    accessLevel: twitchAccessLevelEnum("accessLevel").notNull(),
  },
  (t) => [
    unique("DefaultCommandOverride_botChannelId_commandName_key").on(
      t.botChannelId,
      t.commandName
    ),
  ]
);

export const giveaways = pgTable(
  "Giveaway",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    keyword: text("keyword").notNull(),
    isActive: boolean("isActive").notNull().default(true),
    winnerName: text("winnerName"),
    botChannelId: text("botChannelId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("Giveaway_botChannelId_isActive_idx").on(
      t.botChannelId,
      t.isActive
    ),
  ]
);

export const giveawayEntries = pgTable(
  "GiveawayEntry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    giveawayId: text("giveawayId").notNull(),
    twitchUsername: text("twitchUsername").notNull(),
    twitchUserId: text("twitchUserId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    unique("GiveawayEntry_giveawayId_twitchUserId_key").on(
      t.giveawayId,
      t.twitchUserId
    ),
  ]
);

export const playlists = pgTable(
  "Playlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    botChannelId: text("botChannelId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("Playlist_name_botChannelId_key").on(t.name, t.botChannelId),
  ]
);

export const playlistEntries = pgTable(
  "PlaylistEntry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    youtubeVideoId: text("youtubeVideoId"),
    youtubeDuration: integer("youtubeDuration"),
    youtubeThumbnail: text("youtubeThumbnail"),
    youtubeChannel: text("youtubeChannel"),
    playlistId: text("playlistId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    index("PlaylistEntry_playlistId_position_idx").on(
      t.playlistId,
      t.position
    ),
  ]
);
