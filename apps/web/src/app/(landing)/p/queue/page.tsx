import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Trophy, ArrowLeft } from "lucide-react";

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
    title: `Viewer Queue — ${user.name}`,
    description: `${user.name}'s viewer queue — see who's in line and join from chat.`,
  };
}

async function getQueueData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const queueState = await prisma.queueState.findFirst({
    where: { id: "singleton" },
  });

  const queueEntries = await prisma.queueEntry.findMany({
    orderBy: { position: "asc" },
  });

  return { queueState, queueEntries };
}

export default async function QueuePage() {
  const data = await getQueueData();
  if (!data) return notFound();

  const { queueState, queueEntries } = data;

  return (
    <>
      <div className="animate-fade-in-up flex items-center gap-3">
        <Link
          href={"/p" as Route}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Viewer Queue</h1>
        {queueState && (
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
              queueState.status === "OPEN"
                ? "bg-green-500/20 text-green-600 dark:text-green-400"
                : queueState.status === "PAUSED"
                  ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                  : "bg-surface-raised text-muted-foreground"
            }`}
          >
            {queueState.status === "OPEN"
              ? "Open"
              : queueState.status === "PAUSED"
                ? "Paused"
                : "Closed"}
          </span>
        )}
      </div>

      {queueEntries.length > 0 ? (
        <div
          className="animate-fade-in-up overflow-hidden rounded-lg border border-border bg-card"
          style={{ animationDelay: "100ms" }}
        >
          <ol className="divide-y divide-border">
            {queueEntries.map((entry, i) => (
              <li
                key={entry.id}
                className="animate-fade-in-up flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised"
                style={{ animationDelay: `${150 + i * 50}ms` }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised font-mono text-sm font-bold text-muted-foreground">
                  {entry.position}
                </span>
                <span className="text-sm text-muted-foreground">
                  {entry.twitchUsername}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div
          className="animate-fade-in-up rounded-lg border border-border bg-card p-8 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {queueState?.status === "CLOSED"
              ? "The queue is currently closed."
              : "No one in the queue yet. Join from chat!"}
          </p>
        </div>
      )}
    </>
  );
}
