-- AlterTable
ALTER TABLE "DiscordGuild" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "icon" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "DiscordGuild_userId_idx" ON "DiscordGuild"("userId");
