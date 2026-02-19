-- CreateTable
CREATE TABLE "BotChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twitchUsername" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "disabledCommands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultCommandOverride" (
    "id" TEXT NOT NULL,
    "botChannelId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "accessLevel" "TwitchAccessLevel" NOT NULL,

    CONSTRAINT "DefaultCommandOverride_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "TwitchChatCommand_name_key";

-- AlterTable
ALTER TABLE "TwitchChatCommand" ADD COLUMN "botChannelId" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BotChannel_userId_key" ON "BotChannel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BotChannel_twitchUserId_key" ON "BotChannel"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DefaultCommandOverride_botChannelId_commandName_key" ON "DefaultCommandOverride"("botChannelId", "commandName");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchChatCommand_name_botChannelId_key" ON "TwitchChatCommand"("name", "botChannelId");

-- AddForeignKey
ALTER TABLE "TwitchChatCommand" ADD CONSTRAINT "TwitchChatCommand_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotChannel" ADD CONSTRAINT "BotChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefaultCommandOverride" ADD CONSTRAINT "DefaultCommandOverride_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
