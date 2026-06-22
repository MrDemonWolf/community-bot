import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Single-tenant: exactly one row, id = "singleton". The setup wizard writes it;
// afterwards it's the Settings page. Secret columns hold AES-GCM blobs (see crypto.ts).
export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("singleton"),

  setupComplete: boolean("setup_complete").default(false).notNull(),

  // Core
  botName: text("bot_name").default("HowlBot").notNull(),
  accentColor: text("accent_color").default("#0FACED").notNull(),
  commandPrefix: text("command_prefix").default("!").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  channelName: text("channel_name"),

  // Twitch broadcaster (channel identity + read scopes)
  broadcasterUserId: text("broadcaster_user_id"),
  broadcasterLogin: text("broadcaster_login"),
  broadcasterTokenEnc: text("broadcaster_token_enc"),

  // Twitch bot — wolfaide (chat:read + chat:edit)
  botUserId: text("bot_user_id"),
  botLogin: text("bot_login"),
  botTokenEnc: text("bot_token_enc"),

  // Optional / coming soon (Part 2)
  discordTokenEnc: text("discord_token_enc"),
  discordGuildId: text("discord_guild_id"),
  geminiKeyEnc: text("gemini_key_enc"),
  weatherkitKeyId: text("weatherkit_key_id"),
  weatherkitTeamId: text("weatherkit_team_id"),
  weatherkitP8Enc: text("weatherkit_p8_enc"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Settings = typeof settings.$inferSelect;
