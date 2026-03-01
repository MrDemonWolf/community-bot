-- AlterTable: Add muted column
ALTER TABLE "DiscordGuild" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Drop unused welcome/leave/auto-role/DM columns
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "welcomeEnabled";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "welcomeChannelId";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "welcomeMessage";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "welcomeUseEmbed";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "welcomeEmbedJson";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "leaveEnabled";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "leaveChannelId";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "leaveMessage";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "leaveUseEmbed";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "leaveEmbedJson";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "autoRoleEnabled";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "autoRoleId";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "dmWelcomeEnabled";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "dmWelcomeMessage";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "dmWelcomeUseEmbed";
ALTER TABLE "DiscordGuild" DROP COLUMN IF EXISTS "dmWelcomeEmbedJson";
