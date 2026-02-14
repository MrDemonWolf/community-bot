import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { User, Trophy, Terminal, ArrowLeft } from "lucide-react";

async function getQueueData(slug: string) {
  const user = await prisma.user.findFirst({
    where: { name: { equals: slug, mode: "insensitive" } },
  });

  if (!user) return null;

  const queueState = await prisma.queueState.findFirst({
    where: { id: "singleton" },
  });

  const queueEntries = await prisma.queueEntry.findMany({
    orderBy: { position: "asc" },
  });

  const commands = await prisma.twitchChatCommand.findMany({
    where: { hidden: false, enabled: true },
    select: { name: true },
  });

  return { user, queueState, queueEntries, hasCommands: commands.length > 0 };
}

export default async function QueuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getQueueData(slug);

  if (!data) return notFound();

  const { user, queueState, queueEntries, hasCommands } = data;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-32 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-[#0a1a3a] dark:via-[#091533] dark:to-[#0d1f42]" />

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
                  className="rounded-lg border-2 border-white bg-gray-100 dark:border-[#091533] dark:bg-[#0d1f42]"
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-white bg-gray-100 dark:border-[#091533] dark:bg-[#0d1f42]">
                  <User className="h-5 w-5 text-gray-300 dark:text-white/30" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">{user.name}</h2>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              <SidebarLink
                href={`/c/${slug}`}
                icon={<User className="h-4 w-4" />}
                label="Profile"
              />
              {hasCommands && (
                <SidebarLink
                  href={`/c/${slug}/commands`}
                  icon={<Terminal className="h-4 w-4" />}
                  label="Commands"
                />
              )}
              <SidebarLink
                href={`/c/${slug}/queue`}
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
                href={`/c/${slug}` as Route}
                className="text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Viewer Queue</h1>
              {queueState && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                    queueState.status === "OPEN"
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : queueState.status === "PAUSED"
                        ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-white/40"
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
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0d1f42]">
                <ol className="divide-y divide-gray-100 dark:divide-white/5">
                  {queueEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 font-mono text-sm font-bold text-gray-400 dark:bg-white/5 dark:text-white/40">
                        {entry.position}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-white/70">
                        {entry.twitchUsername}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#0d1f42]">
                <Trophy className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-white/20" />
                <p className="text-gray-400 dark:text-white/40">
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
          ? "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/70"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
