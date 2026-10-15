CREATE TABLE "personal_avatar" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"webp" "bytea" NOT NULL,
	"version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_avatar_user_id_source_pk" PRIMARY KEY("user_id","source"),
	CONSTRAINT "personal_avatar_source" CHECK ("personal_avatar"."source" IN ('twitch','discord','custom')),
	CONSTRAINT "personal_avatar_size" CHECK (octet_length("personal_avatar"."webp") BETWEEN 12 AND 262144),
	CONSTRAINT "personal_avatar_webp" CHECK (substring("personal_avatar"."webp" from 1 for 4) = decode('52494646','hex') AND substring("personal_avatar"."webp" from 9 for 4) = decode('57454250','hex')),
	CONSTRAINT "personal_avatar_version" CHECK ("personal_avatar"."version" ~ '^[0-9a-f-]{36}$')
);
--> statement-breakpoint
CREATE TABLE "personal_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'default' NOT NULL,
	CONSTRAINT "personal_profile_source" CHECK ("personal_profile"."source" IN ('default','twitch','discord','custom'))
);
--> statement-breakpoint
ALTER TABLE "personal_avatar" ADD CONSTRAINT "personal_avatar_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_profile" ADD CONSTRAINT "personal_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;