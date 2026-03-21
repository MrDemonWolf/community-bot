import { notFound } from "next/navigation";
import { db, eq, asc, users, botChannels, songRequestSettings, songRequests } from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Music, ArrowLeft, Volume2, ListMusic } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return {};

  const user = await db.query.users.findFirst({
    where: eq(users.id, broadcasterId),
    columns: { name: true },
  });

  if (!user) return {};

  return {
    title: `Song Requests — ${user.name}`,
    description: `${user.name}'s song request queue — see what's playing and what's next.`,
  };
}

async function getSongRequestData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, broadcasterId),
    columns: { id: true },
  });

  if (!botChannel) return null;

  const settings = await db.query.songRequestSettings.findFirst({
    where: eq(songRequestSettings.botChannelId, botChannel.id),
    columns: { enabled: true },
  });

  const songRequestList = await db.query.songRequests.findMany({
    where: eq(songRequests.botChannelId, botChannel.id),
    orderBy: asc(songRequests.position),
    columns: { id: true, position: true, title: true, requestedBy: true, youtubeChannel: true },
  });

  return { enabled: settings?.enabled ?? false, songRequests: songRequestList };
}

export default async function SongRequestsPage() {
  const data = await getSongRequestData();
  if (!data) return notFound();

  const { enabled, songRequests } = data;
  const currentSong = songRequests.length > 0 ? songRequests[0] : null;
  const upNext = songRequests.slice(1);

  return (
    <>
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Link
            href={"/p" as Route}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Song Requests
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
              enabled
                ? "bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/25"
                : "bg-muted text-muted-foreground ring-1 ring-border"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                enabled ? "bg-green-500" : "bg-muted-foreground"
              }`}
            />
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {enabled
            ? `${songRequests.length} song${songRequests.length !== 1 ? "s" : ""} in queue`
            : "Song requests are currently disabled."}
        </p>
      </div>

      {!enabled ? (
        /* Disabled state */
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-10 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Music className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">
            Song requests are disabled
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back later when the streamer enables them.
          </p>
        </div>
      ) : songRequests.length === 0 ? (
        /* Empty state */
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-10 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-main/10">
            <Music className="h-7 w-7 text-brand-main" />
          </div>
          <p className="text-lg font-medium text-foreground">
            No songs in queue
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to request! Type{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
              !sr &lt;song&gt;
            </code>{" "}
            in chat.
          </p>
        </div>
      ) : (
        <>
          {/* Now Playing */}
          {currentSong && (
            <div
              className="animate-fade-in-up overflow-hidden rounded-xl border border-brand-main/30 bg-brand-main/5"
              style={{ animationDelay: "100ms" }}
            >
              <div className="flex items-center gap-2 border-b border-brand-main/20 px-4 py-2">
                <Volume2 className="h-4 w-4 text-brand-main" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-main">
                  Now Playing
                </span>
              </div>
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-main/15">
                  <Music className="h-5 w-5 text-brand-main" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {currentSong.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by{" "}
                    <span className="font-medium text-foreground/80">
                      {currentSong.requestedBy}
                    </span>
                    {currentSong.youtubeChannel && (
                      <span>
                        {" "}
                        &middot; {currentSong.youtubeChannel}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <div
              className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card"
              style={{ animationDelay: "180ms" }}
            >
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
                <ListMusic className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Up Next
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {upNext.length} song{upNext.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Table header - desktop only */}
              <div className="hidden border-b border-border px-4 py-2 sm:grid sm:grid-cols-[3rem_1fr_10rem]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  #
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Title
                </span>
                <span className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Requested By
                </span>
              </div>

              <ol className="divide-y divide-border">
                {upNext.map((song, i) => (
                  <li
                    key={song.id}
                    className="animate-fade-in-up grid grid-cols-[2.5rem_1fr] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised sm:grid-cols-[3rem_1fr_10rem]"
                    style={{ animationDelay: `${220 + i * 40}ms` }}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised font-mono text-sm font-bold text-muted-foreground">
                      {song.position}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {song.title}
                      </p>
                      {/* Mobile: show requested by inline */}
                      <p className="truncate text-xs text-muted-foreground sm:hidden">
                        Requested by {song.requestedBy}
                      </p>
                    </div>
                    <span className="hidden truncate text-right text-sm text-muted-foreground sm:block">
                      {song.requestedBy}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </>
  );
}
