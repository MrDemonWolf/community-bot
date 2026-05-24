CREATE TABLE "app_config" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"bot_display_name" text DEFAULT 'community-bot' NOT NULL,
	"discord_guild_id" text,
	"stream_alert_channel_id" text,
	"alert_embed_style" text DEFAULT 'rich' NOT NULL,
	"alert_everyone" boolean DEFAULT false NOT NULL,
	"bot_mode" text DEFAULT 'single_account' NOT NULL,
	"role_map" jsonb,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"setup_step" integer DEFAULT 1 NOT NULL,
	"setup_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_config_singleton_check" CHECK ("app_config"."id" = 1),
	CONSTRAINT "app_config_bot_mode_check" CHECK ("app_config"."bot_mode" IN ('single_account','separate_account')),
	CONSTRAINT "app_config_embed_style_check" CHECK ("app_config"."alert_embed_style" IN ('rich','plain')),
	CONSTRAINT "app_config_setup_step_range_check" CHECK ("app_config"."setup_step" BETWEEN 1 AND 9)
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"purpose" text PRIMARY KEY NOT NULL,
	"access_ciphertext" text,
	"refresh_ciphertext" text,
	"scope" text,
	"account_login" text,
	"account_id" text,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_tokens_purpose_check" CHECK ("oauth_tokens"."purpose" IN ('twitch_broadcaster','twitch_bot','discord_bot'))
);
