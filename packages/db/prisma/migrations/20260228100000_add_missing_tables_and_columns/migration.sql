-- ============================================================
-- Add all missing tables and columns to sync with Prisma schema
-- ============================================================

-- --------------------------------------------------------
-- BotChannel: add missing column
-- --------------------------------------------------------
ALTER TABLE "BotChannel" ADD COLUMN "aiShoutoutEnabled" BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- DiscordGuild: add missing columns
-- --------------------------------------------------------
ALTER TABLE "DiscordGuild" ADD COLUMN "welcomeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "welcomeChannelId" TEXT;
ALTER TABLE "DiscordGuild" ADD COLUMN "welcomeMessage" TEXT;
ALTER TABLE "DiscordGuild" ADD COLUMN "welcomeUseEmbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "welcomeEmbedJson" TEXT;

ALTER TABLE "DiscordGuild" ADD COLUMN "leaveEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "leaveChannelId" TEXT;
ALTER TABLE "DiscordGuild" ADD COLUMN "leaveMessage" TEXT;
ALTER TABLE "DiscordGuild" ADD COLUMN "leaveUseEmbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "leaveEmbedJson" TEXT;

ALTER TABLE "DiscordGuild" ADD COLUMN "adminRoleId" TEXT;
ALTER TABLE "DiscordGuild" ADD COLUMN "modRoleId" TEXT;

ALTER TABLE "DiscordGuild" ADD COLUMN "autoRoleEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "autoRoleId" TEXT;

ALTER TABLE "DiscordGuild" ADD COLUMN "dmWelcomeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "dmWelcomeMessage" TEXT;
ALTER TABLE "DiscordGuild" ADD COLUMN "dmWelcomeUseEmbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscordGuild" ADD COLUMN "dmWelcomeEmbedJson" TEXT;

-- --------------------------------------------------------
-- TwitchChannel: add missing columns
-- --------------------------------------------------------
ALTER TABLE "TwitchChannel" ADD COLUMN "notificationChannelId" TEXT;
ALTER TABLE "TwitchChannel" ADD COLUMN "notificationRoleId" TEXT;

ALTER TABLE "TwitchChannel" ADD COLUMN "updateMessageLive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TwitchChannel" ADD COLUMN "deleteWhenOffline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TwitchChannel" ADD COLUMN "autoPublish" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TwitchChannel" ADD COLUMN "useCustomMessage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TwitchChannel" ADD COLUMN "customOnlineMessage" TEXT;
ALTER TABLE "TwitchChannel" ADD COLUMN "customOfflineMessage" TEXT;

-- --------------------------------------------------------
-- CreateTable: Quote
-- --------------------------------------------------------
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "game" TEXT,
    "addedBy" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'twitch',
    "botChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quote_quoteNumber_botChannelId_key" ON "Quote"("quoteNumber", "botChannelId");

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------
-- CreateTable: TwitchCounter
-- --------------------------------------------------------
CREATE TABLE "TwitchCounter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "botChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwitchCounter_name_botChannelId_key" ON "TwitchCounter"("name", "botChannelId");

ALTER TABLE "TwitchCounter" ADD CONSTRAINT "TwitchCounter_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------
-- CreateTable: TwitchTimer
-- --------------------------------------------------------
CREATE TABLE "TwitchTimer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "chatLines" INTEGER NOT NULL DEFAULT 0,
    "botChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchTimer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwitchTimer_name_botChannelId_key" ON "TwitchTimer"("name", "botChannelId");

ALTER TABLE "TwitchTimer" ADD CONSTRAINT "TwitchTimer_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------
-- CreateTable: SpamFilter
-- --------------------------------------------------------
CREATE TABLE "SpamFilter" (
    "id" TEXT NOT NULL,
    "botChannelId" TEXT NOT NULL,
    "capsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "capsMinLength" INTEGER NOT NULL DEFAULT 15,
    "capsMaxPercent" INTEGER NOT NULL DEFAULT 70,
    "linksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linksAllowSubs" BOOLEAN NOT NULL DEFAULT true,
    "symbolsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "symbolsMaxPercent" INTEGER NOT NULL DEFAULT 50,
    "emotesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emotesMaxCount" INTEGER NOT NULL DEFAULT 15,
    "repetitionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "repetitionMaxRepeat" INTEGER NOT NULL DEFAULT 10,
    "bannedWordsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bannedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exemptLevel" "TwitchAccessLevel" NOT NULL DEFAULT 'SUBSCRIBER',
    "timeoutDuration" INTEGER NOT NULL DEFAULT 5,
    "warningMessage" TEXT NOT NULL DEFAULT 'Please don''t spam.',

    CONSTRAINT "SpamFilter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpamFilter_botChannelId_key" ON "SpamFilter"("botChannelId");

ALTER TABLE "SpamFilter" ADD CONSTRAINT "SpamFilter_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------
-- CreateTable: SpamPermit
-- --------------------------------------------------------
CREATE TABLE "SpamPermit" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "botChannelId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpamPermit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpamPermit_username_botChannelId_idx" ON "SpamPermit"("username", "botChannelId");

-- --------------------------------------------------------
-- CreateTable: SongRequest
-- --------------------------------------------------------
CREATE TABLE "SongRequest" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "botChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SongRequest_botChannelId_position_idx" ON "SongRequest"("botChannelId", "position");

ALTER TABLE "SongRequest" ADD CONSTRAINT "SongRequest_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------
-- CreateTable: SongRequestSettings
-- --------------------------------------------------------
CREATE TABLE "SongRequestSettings" (
    "id" TEXT NOT NULL,
    "botChannelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 50,
    "maxPerUser" INTEGER NOT NULL DEFAULT 5,
    "minAccessLevel" "TwitchAccessLevel" NOT NULL DEFAULT 'EVERYONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongRequestSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SongRequestSettings_botChannelId_key" ON "SongRequestSettings"("botChannelId");

ALTER TABLE "SongRequestSettings" ADD CONSTRAINT "SongRequestSettings_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
