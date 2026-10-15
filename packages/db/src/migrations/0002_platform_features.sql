CREATE TABLE "feature_config" (
	"feature_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_config_id" CHECK ("feature_config"."feature_id" ~ '^[a-z][a-z0-9_.-]{0,79}$'),
	CONSTRAINT "feature_config_object" CHECK (jsonb_typeof("feature_config"."config") = 'object'),
	CONSTRAINT "feature_config_version" CHECK ("feature_config"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "permission_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"source_role_id" text NOT NULL,
	"role" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_mapping_provider" CHECK ("permission_mapping"."provider" IN ('twitch', 'discord')),
	CONSTRAINT "permission_mapping_source" CHECK (char_length("permission_mapping"."source_role_id") BETWEEN 1 AND 100),
	CONSTRAINT "permission_mapping_role" CHECK ("permission_mapping"."role" IN ('admin', 'lead_moderator', 'moderator', 'vip', 'subscriber')),
	CONSTRAINT "permission_mapping_scopes" CHECK (jsonb_typeof("permission_mapping"."scopes") = 'array' AND "permission_mapping"."scopes" <@ '["twitch", "discord"]'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "platform_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"login" text NOT NULL,
	"token_enc" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "platform_identity_provider" CHECK ("platform_identity"."provider" IN ('twitch', 'discord')),
	CONSTRAINT "platform_identity_native_id" CHECK ("platform_identity"."provider_user_id" ~ '^[0-9]{1,20}$'),
	CONSTRAINT "platform_identity_login" CHECK (char_length("platform_identity"."login") BETWEEN 1 AND 100),
	CONSTRAINT "platform_identity_token" CHECK (char_length("platform_identity"."token_enc") BETWEEN 1 AND 65536),
	CONSTRAINT "platform_identity_roles" CHECK (jsonb_typeof("platform_identity"."roles") = 'array' AND NOT jsonb_path_exists("platform_identity"."roles", '$[*] ? (@.type() != "string")'))
);
--> statement-breakpoint
CREATE TABLE "redemption" (
	"redemption_id" text PRIMARY KEY NOT NULL,
	"reward_id" text NOT NULL,
	"broadcaster_id" text NOT NULL,
	"user_id" text NOT NULL,
	"login" text NOT NULL,
	"input" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"action_state" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "redemption_id" CHECK (char_length("redemption"."redemption_id") BETWEEN 1 AND 100 AND char_length("redemption"."reward_id") BETWEEN 1 AND 100),
	CONSTRAINT "redemption_users" CHECK ("redemption"."broadcaster_id" ~ '^[0-9]{1,20}$' AND "redemption"."user_id" ~ '^[0-9]{1,20}$'),
	CONSTRAINT "redemption_login" CHECK (char_length("redemption"."login") BETWEEN 1 AND 100),
	CONSTRAINT "redemption_input" CHECK (char_length("redemption"."input") <= 10000),
	CONSTRAINT "redemption_status" CHECK ("redemption"."status" IN ('pending', 'fulfilled', 'canceled')),
	CONSTRAINT "redemption_action_state" CHECK ("redemption"."action_state" IN ('pending', 'processing', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "reward_config" (
	"reward_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"cost" integer NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"chat_response" text,
	"auto_fulfill" boolean DEFAULT false NOT NULL,
	"is_managed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_config_id" CHECK (char_length("reward_config"."reward_id") BETWEEN 1 AND 100),
	CONSTRAINT "reward_config_title" CHECK (char_length(btrim("reward_config"."title")) BETWEEN 1 AND 45 AND char_length("reward_config"."title") <= 45),
	CONSTRAINT "reward_config_cost" CHECK ("reward_config"."cost" >= 1),
	CONSTRAINT "reward_config_prompt" CHECK (char_length("reward_config"."prompt") <= 200),
	CONSTRAINT "reward_config_response" CHECK ("reward_config"."chat_response" IS NULL OR char_length("reward_config"."chat_response") <= 500)
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "permission_sync_twitch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "permission_sync_discord" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "channel_points_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "twitch_lead_moderator_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "discord_client_secret_enc" text;--> statement-breakpoint
ALTER TABLE "platform_identity" ADD CONSTRAINT "platform_identity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "permission_mapping_source_role_unique" ON "permission_mapping" USING btree ("provider","source_role_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_identity_provider_user_unique" ON "platform_identity" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_identity_user_provider_unique" ON "platform_identity" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "redemption_status_received_idx" ON "redemption" USING btree ("status","received_at");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_twitch_lead_moderator_ids" CHECK (jsonb_typeof("settings"."twitch_lead_moderator_ids") = 'array' AND NOT jsonb_path_exists("settings"."twitch_lead_moderator_ids", '$[*] ? (@.type() != "string" || !(@ like_regex "^[0-9]{1,20}$"))'));