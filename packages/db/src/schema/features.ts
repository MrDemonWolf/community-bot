import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const platformIdentity = pgTable("platform_identity", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").$type<"twitch" | "discord">().notNull(),
  providerUserId: text("provider_user_id").notNull(),
  login: text("login").notNull(),
  tokenEnc: text("token_enc").notNull(),
  roles: jsonb("roles").$type<string[]>().default([]).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("platform_identity_provider_user_unique").on(table.provider, table.providerUserId),
  uniqueIndex("platform_identity_user_provider_unique").on(table.userId, table.provider),
  check("platform_identity_provider", sql`${table.provider} IN ('twitch', 'discord')`),
  check("platform_identity_native_id", sql`${table.providerUserId} ~ '^[0-9]{1,20}$'`),
  check("platform_identity_login", sql`char_length(${table.login}) BETWEEN 1 AND 100`),
  check("platform_identity_token", sql`char_length(${table.tokenEnc}) BETWEEN 1 AND 65536`),
  check("platform_identity_roles", sql`jsonb_typeof(${table.roles}) = 'array' AND NOT jsonb_path_exists(${table.roles}, '$[*] ? (@.type() != "string")')`),
]);

export const permissionMapping = pgTable("permission_mapping", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").$type<"twitch" | "discord">().notNull(),
  sourceRoleId: text("source_role_id").notNull(),
  role: text("role").$type<"admin" | "lead_moderator" | "moderator" | "vip" | "subscriber">().notNull(),
  scopes: jsonb("scopes").$type<Array<"twitch" | "discord">>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("permission_mapping_source_role_unique").on(table.provider, table.sourceRoleId, table.role),
  check("permission_mapping_provider", sql`${table.provider} IN ('twitch', 'discord')`),
  check("permission_mapping_source", sql`char_length(${table.sourceRoleId}) BETWEEN 1 AND 100`),
  check("permission_mapping_role", sql`${table.role} IN ('admin', 'lead_moderator', 'moderator', 'vip', 'subscriber')`),
  check("permission_mapping_scopes", sql`jsonb_typeof(${table.scopes}) = 'array' AND ${table.scopes} <@ '["twitch", "discord"]'::jsonb`),
]);

export const featureConfig = pgTable("feature_config", {
  featureId: text("feature_id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
  version: integer("version").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  check("feature_config_id", sql`${table.featureId} ~ '^[a-z][a-z0-9_.-]{0,79}$'`),
  check("feature_config_object", sql`jsonb_typeof(${table.config}) = 'object'`),
  check("feature_config_version", sql`${table.version} > 0`),
]);

export const redemption = pgTable("redemption", {
  redemptionId: text("redemption_id").primaryKey(),
  rewardId: text("reward_id").notNull(),
  broadcasterId: text("broadcaster_id").notNull(),
  userId: text("user_id").notNull(),
  login: text("login").notNull(),
  input: text("input").default("").notNull(),
  status: text("status").$type<"pending" | "fulfilled" | "canceled">().default("pending").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  actionState: text("action_state").$type<"pending" | "processing" | "sent" | "failed">().default("pending").notNull(),
}, (table) => [
  index("redemption_status_received_idx").on(table.status, table.receivedAt),
  check("redemption_id", sql`char_length(${table.redemptionId}) BETWEEN 1 AND 100 AND char_length(${table.rewardId}) BETWEEN 1 AND 100`),
  check("redemption_users", sql`${table.broadcasterId} ~ '^[0-9]{1,20}$' AND ${table.userId} ~ '^[0-9]{1,20}$'`),
  check("redemption_login", sql`char_length(${table.login}) BETWEEN 1 AND 100`),
  check("redemption_input", sql`char_length(${table.input}) <= 10000`),
  check("redemption_status", sql`${table.status} IN ('pending', 'fulfilled', 'canceled')`),
  check("redemption_action_state", sql`${table.actionState} IN ('pending', 'processing', 'sent', 'failed')`),
]);

export const rewardConfig = pgTable("reward_config", {
  rewardId: text("reward_id").primaryKey(),
  title: text("title").notNull(),
  cost: integer("cost").notNull(),
  prompt: text("prompt").default("").notNull(),
  chatResponse: text("chat_response"),
  autoFulfill: boolean("auto_fulfill").default(false).notNull(),
  isManaged: boolean("is_managed").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  check("reward_config_id", sql`char_length(${table.rewardId}) BETWEEN 1 AND 100`),
  check("reward_config_title", sql`char_length(btrim(${table.title})) BETWEEN 1 AND 45 AND char_length(${table.title}) <= 45`),
  check("reward_config_cost", sql`${table.cost} >= 1`),
  check("reward_config_prompt", sql`char_length(${table.prompt}) <= 200`),
  check("reward_config_response", sql`${table.chatResponse} IS NULL OR char_length(${table.chatResponse}) <= 500`),
]);
