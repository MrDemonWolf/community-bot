import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { User, Trophy, Terminal, ArrowLeft } from "lucide-react";

async function getQueueData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const user = await prisma.user.findUnique({
    where: { id: broadcasterId },
  });

  if (!user) return null;

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const queueState = await prisma.queueState.findFirst({
    where: { id: "singleton" },
  });

  const queueEntries = await prisma.queueEntry.findMany({
    orderBy: { position: "asc" },
  });

  const commands = botChannel
    ? await prisma.twitchChatCommand.findMany({
        where: { hidden: false, enabled: true, botChannelId: botChannel.id },
        select: { name: true },
      })
    : [];

  return { user, queueState, queueEntries, hasCommands: commands.length > 0 };
}

export default async function QueuePage() {
  const data = await getQueueData();

  if (!data) return notFound();

  const { user, queueState, queueEntries, hasCommands } = data;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-32 bg-gradient-to-br from-muted via-background to-muted" />

      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-col gap-8 sm:flex-row">
          {/* Sidebar */}
          <div className="-mt-8 flex w-full flex-col gap-6 sm:w-64 sm:shrink-0">
            <div className="flex items-center gap-3">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={48}
                  height={48}
                  className="rounded-lg border-2 border-background bg-card"
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-background bg-card">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-foreground">{user.name}</h2>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              <SidebarLink
                href="/public"
                icon={<User className="h-4 w-4" />}
                label="Profile"
              />
              {hasCommands && (
                <SidebarLink
                  href="/public/commands"
                  icon={<Terminal className="h-4 w-4" />}
                  label="Commands"
                />
              )}
              <SidebarLink
                href="/public/queue"
                icon={<Trophy className="h-4 w-4" />}
                label="Queue"
                active
              />
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-6 pb-16 pt-6">
            <div className="flex items-center gap-3">
              <Link
                href={"/public" as Route}
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
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <ol className="divide-y divide-border">
                  {queueEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised"
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
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {queueState?.status === "CLOSED"
                    ? "The queue is currently closed."
                    : "No one in the queue yet. Join from chat!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-surface-raised text-foreground"
          : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
