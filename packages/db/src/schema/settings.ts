import { sql } from "drizzle-orm";
import { boolean, check, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  setupComplete: boolean("setup_complete").default(false).notNull(),
  botName: text("bot_name").default("WolfAide").notNull(),
  commandPrefix: text("command_prefix").default("!").notNull(),
  channelName: text("channel_name"),
  publicPageEnabled: boolean("public_page_enabled").default(false).notNull(),
  publicDescription: text("public_description")
    .default("A little help for the community.")
    .notNull(),
  twitchClientId: text("twitch_client_id"),
  twitchClientSecretEnc: text("twitch_client_secret_enc"),
  broadcasterUserId: text("broadcaster_user_id"),
  broadcasterLogin: text("broadcaster_login"),
  broadcasterTokenEnc: text("broadcaster_token_enc"),
  botUserId: text("bot_user_id"),
  botLogin: text("bot_login"),
  botTokenEnc: text("bot_token_enc"),
  twitchEnabled: boolean("twitch_enabled").default(false).notNull(),
  twitchMuted: boolean("twitch_muted").default(false).notNull(),
  permissionSyncTwitch: boolean("permission_sync_twitch").default(false).notNull(),
  permissionSyncDiscord: boolean("permission_sync_discord").default(false).notNull(),
  channelPointsEnabled: boolean("channel_points_enabled").default(false).notNull(),
  twitchLeadModeratorIds: jsonb("twitch_lead_moderator_ids").$type<string[]>().default([]).notNull(),
  discordTokenEnc: text("discord_token_enc"),
  discordClientSecretEnc: text("discord_client_secret_enc"),
  discordApplicationId: text("discord_application_id"),
  discordGuildId: text("discord_guild_id"),
  discordEnabled: boolean("discord_enabled").default(false).notNull(),
  discordStatus: text("discord_status").default("online").notNull(),
  discordActivityType: text("discord_activity_type")
    .default("watching")
    .notNull(),
  discordActivityText: text("discord_activity_text")
    .default("the community")
    .notNull(),
  discordActivityUrl: text("discord_activity_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  check("settings_singleton", sql`${table.id} = 'singleton'`),
  check("settings_twitch_lead_moderator_ids", sql`jsonb_typeof(${table.twitchLeadModeratorIds}) = 'array' AND NOT jsonb_path_exists(${table.twitchLeadModeratorIds}, '$[*] ? (@.type() != "string" || !(@ like_regex "^[0-9]{1,20}$"))')`),
  check("settings_bot_name", sql`char_length(btrim(${table.botName})) BETWEEN 1 AND 40`),
  check("settings_command_prefix", sql`char_length(${table.commandPrefix}) BETWEEN 1 AND 5 AND ${table.commandPrefix} !~ '[[:space:]]'`),
  check("settings_public_description", sql`char_length(${table.publicDescription}) <= 280`),
  check("settings_discord_status", sql`${table.discordStatus} IN ('online', 'idle', 'dnd', 'invisible')`),
  check("settings_discord_activity_type", sql`${table.discordActivityType} IN ('playing', 'listening', 'watching', 'competing', 'custom', 'streaming')`),
  check("settings_discord_activity_text", sql`char_length(${table.discordActivityText}) <= 128`),
  check("settings_discord_activity_url", sql`${table.discordActivityUrl} IS NULL OR char_length(${table.discordActivityUrl}) <= 500`),
  check("settings_discord_application_id", sql`${table.discordApplicationId} IS NULL OR ${table.discordApplicationId} ~ '^[0-9]{17,20}$'`),
  check("settings_discord_guild_id", sql`${table.discordGuildId} IS NULL OR ${table.discordGuildId} ~ '^[0-9]{17,20}$'`),
  check("settings_twitch_client_id", sql`${table.twitchClientId} IS NULL OR ${table.twitchClientId} ~ '^[a-zA-Z0-9]{10,100}$'`),
  check("settings_broadcaster_identity", sql`num_nonnulls(${table.broadcasterUserId}, ${table.broadcasterLogin}, ${table.broadcasterTokenEnc}) IN (0, 3)`),
  check("settings_bot_identity", sql`num_nonnulls(${table.botUserId}, ${table.botLogin}, ${table.botTokenEnc}) IN (0, 3)`),
  check("settings_discord_enabled_credentials", sql`NOT ${table.discordEnabled} OR num_nonnulls(${table.discordTokenEnc}, ${table.discordApplicationId}, ${table.discordGuildId}) = 3`),
  check("settings_twitch_enabled_credentials", sql`NOT ${table.twitchEnabled} OR num_nonnulls(${table.twitchClientId}, ${table.twitchClientSecretEnc}, ${table.broadcasterTokenEnc}, ${table.botTokenEnc}) = 4`),
]);

export const runtime = pgTable("runtime", {
  service: text("service").primaryKey(),
  state: text("state").notNull(),
  detail: text("detail").default("").notNull(),
  identity: text("identity"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
}, (table) => [
  check("runtime_service", sql`${table.service} IN ('discord', 'twitch')`),
  check("runtime_state", sql`${table.state} IN ('starting', 'needs_setup', 'disconnected', 'connecting', 'reconnecting', 'connected', 'guild_unavailable', 'error', 'stopping', 'stopped', 'waiting', 'muted')`),
  check("runtime_metadata_object", sql`jsonb_typeof(${table.metadata}) = 'object'`),
]);

export type Settings = typeof settings.$inferSelect;
