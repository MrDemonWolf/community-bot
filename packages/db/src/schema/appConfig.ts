import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const ALLOWED_BOT_MODES = ["single_account", "separate_account"] as const;
const ALLOWED_EMBED_STYLES = ["rich", "plain"] as const;

export type BotMode = (typeof ALLOWED_BOT_MODES)[number];
export type AlertEmbedStyle = (typeof ALLOWED_EMBED_STYLES)[number];

export const appConfig = pgTable(
  "app_config",
  {
    id: smallint("id").primaryKey().default(1),

    botDisplayName: text("bot_display_name").notNull().default("community-bot"),

    discordGuildId: text("discord_guild_id"),
    streamAlertChannelId: text("stream_alert_channel_id"),
    alertEmbedStyle: text("alert_embed_style").$type<AlertEmbedStyle>().notNull().default("rich"),
    alertEveryone: boolean("alert_everyone").notNull().default(false),

    botMode: text("bot_mode").$type<BotMode>().notNull().default("single_account"),

    roleMap: jsonb("role_map").$type<Record<string, "mod" | "vip" | "sub" | "viewer">>(),

    setupComplete: boolean("setup_complete").notNull().default(false),
    setupStep: integer("setup_step").notNull().default(1),
    setupState: jsonb("setup_state").$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check("app_config_singleton_check", sql`${t.id} = 1`),
    check(
      "app_config_bot_mode_check",
      sql`${t.botMode} IN (${sql.join(
        ALLOWED_BOT_MODES.map((m) => sql`${m}`),
        sql`, `,
      )})`,
    ),
    check(
      "app_config_embed_style_check",
      sql`${t.alertEmbedStyle} IN (${sql.join(
        ALLOWED_EMBED_STYLES.map((m) => sql`${m}`),
        sql`, `,
      )})`,
    ),
    check("app_config_setup_step_range_check", sql`${t.setupStep} BETWEEN 1 AND 9`),
  ],
);
