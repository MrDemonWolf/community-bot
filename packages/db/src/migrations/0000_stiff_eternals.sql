CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime" (
	"service" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"identity" text,
	"started_at" timestamp,
	"heartbeat_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"bot_name" text DEFAULT 'WolfAide' NOT NULL,
	"command_prefix" text DEFAULT '!' NOT NULL,
	"channel_name" text,
	"public_page_enabled" boolean DEFAULT false NOT NULL,
	"public_description" text DEFAULT 'A little help for the community.' NOT NULL,
	"twitch_client_id" text,
	"twitch_client_secret_enc" text,
	"broadcaster_user_id" text,
	"broadcaster_login" text,
	"broadcaster_token_enc" text,
	"bot_user_id" text,
	"bot_login" text,
	"bot_token_enc" text,
	"twitch_enabled" boolean DEFAULT false NOT NULL,
	"twitch_muted" boolean DEFAULT false NOT NULL,
	"discord_token_enc" text,
	"discord_application_id" text,
	"discord_guild_id" text,
	"discord_enabled" boolean DEFAULT false NOT NULL,
	"discord_status" text DEFAULT 'online' NOT NULL,
	"discord_activity_type" text DEFAULT 'watching' NOT NULL,
	"discord_activity_text" text DEFAULT 'the community' NOT NULL,
	"discord_activity_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");