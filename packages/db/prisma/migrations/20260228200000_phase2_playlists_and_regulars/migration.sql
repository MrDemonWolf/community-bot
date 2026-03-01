-- Phase 2: Playlists & Unified Regulars

-- 1. Rename TwitchRegular → Regular
ALTER TABLE "TwitchRegular" RENAME TO "Regular";

-- 2. Make twitchUserId and twitchUsername nullable
ALTER TABLE "Regular" ALTER COLUMN "twitchUserId" DROP NOT NULL;
ALTER TABLE "Regular" ALTER COLUMN "twitchUsername" DROP NOT NULL;

-- 3. Add Discord fields to Regular
ALTER TABLE "Regular" ADD COLUMN "discordUserId" TEXT;
ALTER TABLE "Regular" ADD COLUMN "discordUsername" TEXT;
CREATE UNIQUE INDEX "Regular_discordUserId_key" ON "Regular"("discordUserId");

-- 4. Add YouTube metadata fields to SongRequest
ALTER TABLE "SongRequest" ADD COLUMN "youtubeVideoId" TEXT;
ALTER TABLE "SongRequest" ADD COLUMN "youtubeDuration" INTEGER;
ALTER TABLE "SongRequest" ADD COLUMN "youtubeThumbnail" TEXT;
ALTER TABLE "SongRequest" ADD COLUMN "youtubeChannel" TEXT;
ALTER TABLE "SongRequest" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'viewer';

-- 5. Add new fields to SongRequestSettings
ALTER TABLE "SongRequestSettings" ADD COLUMN "maxDuration" INTEGER;
ALTER TABLE "SongRequestSettings" ADD COLUMN "autoPlayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SongRequestSettings" ADD COLUMN "activePlaylistId" TEXT;

-- 6. Create Playlist table
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "botChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Playlist_name_botChannelId_key" ON "Playlist"("name", "botChannelId");
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_botChannelId_fkey" FOREIGN KEY ("botChannelId") REFERENCES "BotChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Create PlaylistEntry table
CREATE TABLE "PlaylistEntry" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "youtubeVideoId" TEXT,
    "youtubeDuration" INTEGER,
    "youtubeThumbnail" TEXT,
    "youtubeChannel" TEXT,
    "playlistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlaylistEntry_playlistId_position_idx" ON "PlaylistEntry"("playlistId", "position");
ALTER TABLE "PlaylistEntry" ADD CONSTRAINT "PlaylistEntry_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
