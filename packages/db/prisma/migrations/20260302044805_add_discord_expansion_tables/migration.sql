-- CreateEnum
CREATE TYPE "DiscordCaseType" AS ENUM ('BAN', 'TEMPBAN', 'KICK', 'WARN', 'MUTE', 'UNBAN', 'UNWARN', 'UNMUTE', 'NOTE');

-- CreateEnum
CREATE TYPE "DiscordReportStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DiscordScheduleType" AS ENUM ('ONCE', 'RECURRING');

-- AlterTable
ALTER TABLE "Regular" RENAME CONSTRAINT "TwitchRegular_pkey" TO "Regular_pkey";

-- CreateTable
CREATE TABLE "DiscordCustomCommand" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'A custom command',
    "response" TEXT,
    "embedJson" TEXT,
    "ephemeral" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoles" TEXT[],
    "createdBy" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordCustomCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordLogConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderationChannelId" TEXT,
    "serverChannelId" TEXT,
    "voiceChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordLogConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordCase" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "type" "DiscordCaseType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTag" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "reason" TEXT,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordCaseNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorTag" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordCaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordWarnThreshold" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "action" "DiscordCaseType" NOT NULL,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordWarnThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordReport" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reporterTag" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTag" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DiscordReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordRolePanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "useMenu" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordRolePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordRoleButton" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT,
    "style" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordRoleButton_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordScheduledMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscordScheduleType" NOT NULL,
    "cronExpression" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "templateId" TEXT,
    "content" TEXT,
    "embedJson" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "bullMqJobId" TEXT,
    "repeatJobKey" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordMessageTemplate" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "embedJson" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscordCustomCommand_guildId_idx" ON "DiscordCustomCommand"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordCustomCommand_guildId_name_key" ON "DiscordCustomCommand"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLogConfig_guildId_key" ON "DiscordLogConfig"("guildId");

-- CreateIndex
CREATE INDEX "DiscordCase_guildId_idx" ON "DiscordCase"("guildId");

-- CreateIndex
CREATE INDEX "DiscordCase_targetId_idx" ON "DiscordCase"("targetId");

-- CreateIndex
CREATE INDEX "DiscordCase_moderatorId_idx" ON "DiscordCase"("moderatorId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordCase_guildId_caseNumber_key" ON "DiscordCase"("guildId", "caseNumber");

-- CreateIndex
CREATE INDEX "DiscordCaseNote_caseId_idx" ON "DiscordCaseNote"("caseId");

-- CreateIndex
CREATE INDEX "DiscordWarnThreshold_guildId_idx" ON "DiscordWarnThreshold"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordWarnThreshold_guildId_count_key" ON "DiscordWarnThreshold"("guildId", "count");

-- CreateIndex
CREATE INDEX "DiscordReport_guildId_idx" ON "DiscordReport"("guildId");

-- CreateIndex
CREATE INDEX "DiscordReport_status_idx" ON "DiscordReport"("status");

-- CreateIndex
CREATE INDEX "DiscordReport_targetId_idx" ON "DiscordReport"("targetId");

-- CreateIndex
CREATE INDEX "DiscordRolePanel_guildId_idx" ON "DiscordRolePanel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordRolePanel_guildId_name_key" ON "DiscordRolePanel"("guildId", "name");

-- CreateIndex
CREATE INDEX "DiscordRoleButton_panelId_idx" ON "DiscordRoleButton"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordRoleButton_panelId_roleId_key" ON "DiscordRoleButton"("panelId", "roleId");

-- CreateIndex
CREATE INDEX "DiscordScheduledMessage_guildId_idx" ON "DiscordScheduledMessage"("guildId");

-- CreateIndex
CREATE INDEX "DiscordScheduledMessage_enabled_idx" ON "DiscordScheduledMessage"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordScheduledMessage_guildId_name_key" ON "DiscordScheduledMessage"("guildId", "name");

-- CreateIndex
CREATE INDEX "DiscordMessageTemplate_guildId_idx" ON "DiscordMessageTemplate"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordMessageTemplate_guildId_name_key" ON "DiscordMessageTemplate"("guildId", "name");

-- AddForeignKey
ALTER TABLE "DiscordCaseNote" ADD CONSTRAINT "DiscordCaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DiscordCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordRoleButton" ADD CONSTRAINT "DiscordRoleButton_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "DiscordRolePanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "TwitchRegular_twitchUserId_key" RENAME TO "Regular_twitchUserId_key";
