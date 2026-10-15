ALTER TABLE "account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp with time zone USING "access_token_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp with time zone USING "refresh_token_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "runtime" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone USING "started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "runtime" ALTER COLUMN "heartbeat_at" SET DATA TYPE timestamp with time zone USING "heartbeat_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "runtime" ALTER COLUMN "heartbeat_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_case_insensitive_unique" ON "user" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "runtime" ADD CONSTRAINT "runtime_service" CHECK ("runtime"."service" IN ('discord', 'twitch'));--> statement-breakpoint
ALTER TABLE "runtime" ADD CONSTRAINT "runtime_state" CHECK ("runtime"."state" IN ('starting', 'needs_setup', 'disconnected', 'connecting', 'reconnecting', 'connected', 'guild_unavailable', 'error', 'stopping', 'stopped', 'waiting', 'muted'));--> statement-breakpoint
ALTER TABLE "runtime" ADD CONSTRAINT "runtime_metadata_object" CHECK (jsonb_typeof("runtime"."metadata") = 'object');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 'singleton');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_bot_name" CHECK (char_length(btrim("settings"."bot_name")) BETWEEN 1 AND 40);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_command_prefix" CHECK (char_length("settings"."command_prefix") BETWEEN 1 AND 5 AND "settings"."command_prefix" !~ '[[:space:]]');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_public_description" CHECK (char_length("settings"."public_description") <= 280);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_status" CHECK ("settings"."discord_status" IN ('online', 'idle', 'dnd', 'invisible'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_activity_type" CHECK ("settings"."discord_activity_type" IN ('playing', 'listening', 'watching', 'competing', 'custom', 'streaming'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_activity_text" CHECK (char_length("settings"."discord_activity_text") <= 128);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_activity_url" CHECK ("settings"."discord_activity_url" IS NULL OR char_length("settings"."discord_activity_url") <= 500);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_application_id" CHECK ("settings"."discord_application_id" IS NULL OR "settings"."discord_application_id" ~ '^[0-9]{17,20}$');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_guild_id" CHECK ("settings"."discord_guild_id" IS NULL OR "settings"."discord_guild_id" ~ '^[0-9]{17,20}$');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_twitch_client_id" CHECK ("settings"."twitch_client_id" IS NULL OR "settings"."twitch_client_id" ~ '^[a-zA-Z0-9]{10,100}$');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_broadcaster_identity" CHECK (num_nonnulls("settings"."broadcaster_user_id", "settings"."broadcaster_login", "settings"."broadcaster_token_enc") IN (0, 3));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_bot_identity" CHECK (num_nonnulls("settings"."bot_user_id", "settings"."bot_login", "settings"."bot_token_enc") IN (0, 3));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_discord_enabled_credentials" CHECK (NOT "settings"."discord_enabled" OR num_nonnulls("settings"."discord_token_enc", "settings"."discord_application_id", "settings"."discord_guild_id") = 3);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_twitch_enabled_credentials" CHECK (NOT "settings"."twitch_enabled" OR num_nonnulls("settings"."twitch_client_id", "settings"."twitch_client_secret_enc", "settings"."broadcaster_token_enc", "settings"."bot_token_enc") = 4);
