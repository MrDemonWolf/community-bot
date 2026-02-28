import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Music, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return {};

  const user = await prisma.user.findUnique({
    where: { id: broadcasterId },
    select: { name: true },
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

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: broadcasterId },
    select: { id: true },
  });

  if (!botChannel) return null;

  const settings = await prisma.songRequestSettings.findUnique({
    where: { botChannelId: botChannel.id },
    select: { enabled: true },
  });

  const songRequests = await prisma.songRequest.findMany({
    where: { botChannelId: botChannel.id },
    orderBy: { position: "asc" },
    select: { id: true, position: true, title: true, requestedBy: true },
  });

  return { enabled: settings?.enabled ?? false, songRequests };
}

export default async function SongRequestsPage() {
  const data = await getSongRequestData();
  if (!data) return notFound();

  const { enabled, songRequests } = data;

  return (
    <>
      <div className="animate-fade-in-up flex items-center gap-3">
        <Link
          href={"/p" as Route}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Song Requests</h1>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
            enabled
              ? "bg-green-500/20 text-green-600 dark:text-green-400"
              : "bg-surface-raised text-muted-foreground"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {enabled && songRequests.length > 0 ? (
        <div
          className="animate-fade-in-up overflow-hidden rounded-lg border border-border bg-card"
          style={{ animationDelay: "100ms" }}
        >
          <ol className="divide-y divide-border">
            {songRequests.map((song, i) => (
              <li
                key={song.id}
                className="animate-fade-in-up flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised"
                style={{ animationDelay: `${150 + i * 50}ms` }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised font-mono text-sm font-bold text-muted-foreground">
                  {song.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {song.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {song.requestedBy}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div
          className="animate-fade-in-up rounded-lg border border-border bg-card p-8 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <Music className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {enabled
              ? "No songs in the queue."
              : "Song requests are currently disabled."}
          </p>
        </div>
      )}
    </>
  );
}
