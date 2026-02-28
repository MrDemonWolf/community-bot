-- Rename ADMIN → BROADCASTER in the UserRole enum
ALTER TYPE "UserRole" RENAME VALUE 'ADMIN' TO 'BROADCASTER';

-- Add ban fields to User table
ALTER TABLE "User" ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
