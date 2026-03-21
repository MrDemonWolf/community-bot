import { notFound } from "next/navigation";
import { db, eq, asc, users, queueStates, queueEntries } from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Trophy, ArrowLeft, Clock, Users, CircleDot } from "lucide-react";

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
    title: `Viewer Queue — ${user.name}`,
    description: `${user.name}'s viewer queue — see who's in line and join from chat.`,
  };
}

async function getQueueData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const queueState = await db.query.queueStates.findFirst({
    where: eq(queueStates.id, "singleton"),
  });

  const queueEntryList = await db.query.queueEntries.findMany({
    orderBy: asc(queueEntries.position),
  });

  return { queueState, queueEntries: queueEntryList };
}

function formatJoinedTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

export default async function QueuePage() {
  const data = await getQueueData();
  if (!data) return notFound();

  const { queueState, queueEntries } = data;
  const status = queueState?.status ?? "CLOSED";

  const statusConfig = {
    OPEN: {
      label: "Open",
      badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/25",
      dotClass: "bg-green-500",
      message: "Queue is open — type !queue join in chat to join!",
    },
    PAUSED: {
      label: "Paused",
      badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25",
      dotClass: "bg-amber-500",
      message: "Queue is paused — no new entries at this time.",
    },
    CLOSED: {
      label: "Closed",
      badgeClass: "bg-muted text-muted-foreground ring-1 ring-border",
      dotClass: "bg-muted-foreground",
      message: "Queue is currently closed.",
    },
  } as const;

  const currentStatus = statusConfig[status];

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
            Viewer Queue
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${currentStatus.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dotClass}`} />
            {currentStatus.label}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {currentStatus.message}
        </p>
      </div>

      {/* Stats bar */}
      {status !== "CLOSED" && (
        <div
          className="animate-fade-in-up flex gap-4"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Users className="h-4 w-4 text-brand-main" />
            <span className="text-sm font-medium text-foreground">
              {queueEntries.length}
            </span>
            <span className="text-sm text-muted-foreground">
              in queue
            </span>
          </div>
        </div>
      )}

      {/* Queue list */}
      {status === "CLOSED" && queueEntries.length === 0 ? (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-10 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Trophy className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">Queue is closed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back later when the queue opens up.
          </p>
        </div>
      ) : queueEntries.length === 0 ? (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-10 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-main/10">
            <Trophy className="h-7 w-7 text-brand-main" />
          </div>
          <p className="text-lg font-medium text-foreground">Queue is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to join! Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">!queue join</code> in chat.
          </p>
        </div>
      ) : (
        <div
          className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card"
          style={{ animationDelay: "100ms" }}
        >
          {/* Table header */}
          <div className="hidden border-b border-border bg-muted/50 px-4 py-2.5 sm:grid sm:grid-cols-[3rem_1fr_8rem]">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              #
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username
            </span>
            <span className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Joined
            </span>
          </div>

          <ol className="divide-y divide-border">
            {queueEntries.map((entry, i) => (
              <li
                key={entry.id}
                className="animate-fade-in-up grid grid-cols-[2.5rem_1fr] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised sm:grid-cols-[3rem_1fr_8rem]"
                style={{ animationDelay: `${150 + i * 40}ms` }}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold ${
                    i === 0
                      ? "bg-brand-main/15 text-brand-main"
                      : "bg-surface-raised text-muted-foreground"
                  }`}
                >
                  {entry.position}
                </span>
                <span className="truncate text-sm font-medium text-foreground">
                  {entry.twitchUsername}
                </span>
                {"createdAt" in entry && entry.createdAt ? (
                  <span className="hidden items-center gap-1 text-right text-xs text-muted-foreground sm:flex sm:justify-end">
                    <Clock className="h-3 w-3" />
                    {formatJoinedTime(entry.createdAt as Date)}
                  </span>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
