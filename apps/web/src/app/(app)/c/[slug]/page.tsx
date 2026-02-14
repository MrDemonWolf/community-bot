import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  User,
  Trophy,
  Terminal,
  ExternalLink,
} from "lucide-react";
import TwitchEmbed from "./twitch-embed";

const singleChannelMode =
  process.env.NEXT_PUBLIC_SINGLE_CHANNEL_MODE === "true";

async function getChannelData(slug: string) {
  const user = await prisma.user.findFirst({
    where: { name: { equals: slug, mode: "insensitive" } },
    include: {
      accounts: {
        select: {
          providerId: true,
          accountId: true,
        },
      },
    },
  });

  if (!user) return null;

  const twitchAccount = user.accounts.find((a) => a.providerId === "twitch");
  const discordAccount = user.accounts.find((a) => a.providerId === "discord");

  let twitchChannel = null;
  if (twitchAccount) {
    twitchChannel = await prisma.twitchChannel.findFirst({
      where: { twitchChannelId: twitchAccount.accountId },
    });
  }

  const commands = await prisma.twitchChatCommand.findMany({
    where: { hidden: false, enabled: true },
    select: { name: true, response: true, accessLevel: true },
    orderBy: { name: "asc" },
  });

  const queueState = await prisma.queueState.findFirst({
    where: { id: "singleton" },
  });

  const queueEntries =
    queueState?.status === "OPEN"
      ? await prisma.queueEntry.findMany({
          orderBy: { position: "asc" },
          select: { twitchUsername: true, position: true },
        })
      : [];

  return {
    user,
    twitchAccount,
    discordAccount,
    twitchChannel,
    commands,
    queueState,
    queueEntries,
  };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getChannelData(slug);

  if (!data) return notFound();

  const { user, twitchChannel, commands, queueState, queueEntries } = data;
  const isLive = twitchChannel?.isLive ?? false;
  const twitchUsername = twitchChannel?.username;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-[#0a1a3a] dark:via-[#091533] dark:to-[#0d1f42] sm:h-56">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE1VjBoLTJWMTVIMTlWMGgtMnYxNUgwdjJoMTd2MTdIMHYyaDE3djE3aDJ2LTE3aDE1djE3aDJWMzZoMTdWMzRIMzZWMTdoMTdWMTVIMzZ6bS0yIDJ2MTdIMTdWMTdoMTd6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30 dark:opacity-30" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-col gap-8 sm:flex-row">
          {/* Sidebar */}
          <div className="-mt-16 flex w-full flex-col gap-6 sm:w-64 sm:shrink-0">
            {/* Profile Card */}
            <div className="flex flex-col items-center sm:items-start">
              <div className="relative mb-4">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name}
                    width={120}
                    height={120}
                    className="rounded-xl border-4 border-white bg-gray-100 dark:border-[#091533] dark:bg-[#0d1f42]"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-[120px] w-[120px] items-center justify-center rounded-xl border-4 border-white bg-gray-100 dark:border-[#091533] dark:bg-[#0d1f42]">
                    <User className="h-12 w-12 text-gray-300 dark:text-white/30" />
                  </div>
                )}
                {isLive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-red-500 px-2.5 py-0.5 text-xs font-bold uppercase text-white">
                    Live
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
              {twitchUsername && (
                <a
                  href={`https://twitch.tv/${twitchUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 transition-colors hover:text-[#9146FF] dark:text-white/40"
                >
                  twitch.tv/{twitchUsername}
                </a>
              )}
            </div>

            {/* Nav Links */}
            <nav className="flex flex-col gap-1">
              <SidebarLink
                href={`/c/${slug}`}
                icon={<User className="h-4 w-4" />}
                label="Profile"
                active
              />
              {commands.length > 0 && (
                <SidebarLink
                  href={`/c/${slug}/commands`}
                  icon={<Terminal className="h-4 w-4" />}
                  label="Commands"
                />
              )}
              {queueState?.status !== "CLOSED" && (
                <SidebarLink
                  href={`/c/${slug}/queue`}
                  icon={<Trophy className="h-4 w-4" />}
                  label="Queue"
                />
              )}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-6 pb-16 pt-6">
            {/* Twitch Embed */}
            {twitchUsername && (
              <TwitchEmbed channel={twitchUsername} isLive={isLive} />
            )}

            {/* Stream Status Card */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0d1f42]">
              <div className="p-6">
                <span
                  className={`mb-3 inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                    isLive
                      ? "bg-red-500/20 text-red-500 dark:text-red-400"
                      : "border border-gray-200 text-gray-400 dark:border-white/10 dark:text-white/50"
                  }`}
                >
                  {isLive ? "Live" : "Offline"}
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  <span className="text-[#00ACED]">{user.name}</span> is{" "}
                  {isLive ? "live!" : "offline."}
                </h2>
                {twitchChannel?.lastStreamTitle && (
                  <p className="mt-2 text-gray-500 dark:text-white/50">
                    {isLive
                      ? twitchChannel.lastStreamTitle
                      : `Check out this ${twitchChannel.lastGameName || "stream"} from ${
                          twitchChannel.lastStartedAt
                            ? formatTimeAgo(twitchChannel.lastStartedAt)
                            : "recently"
                        }.`}
                  </p>
                )}
                {twitchUsername && (
                  <a
                    href={`https://twitch.tv/${twitchUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#9146FF] transition-colors hover:text-[#7B2FF0]"
                  >
                    <span>&#9654;</span> Watch{" "}
                    {isLive ? "Stream" : "Latest Stream"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Commands Preview */}
            {commands.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0d1f42]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Chat Commands</h3>
                  <Link
                    href={`/c/${slug}/commands` as Route}
                    className="text-sm text-[#00ACED] transition-colors hover:text-[#00ACED]/70"
                  >
                    View all
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {commands.slice(0, 12).map((cmd) => (
                    <span
                      key={cmd.name}
                      className="rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-600 dark:bg-white/5 dark:text-white/60"
                    >
                      !{cmd.name}
                    </span>
                  ))}
                  {commands.length > 12 && (
                    <span className="rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-400 dark:bg-white/5 dark:text-white/40">
                      +{commands.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Queue */}
            {queueState && queueState.status !== "CLOSED" && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0d1f42]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Viewer Queue</h3>
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                      queueState.status === "OPEN"
                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                        : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                    }`}
                  >
                    {queueState.status === "OPEN" ? "Open" : "Paused"}
                  </span>
                </div>
                {queueEntries.length > 0 ? (
                  <ol className="space-y-2">
                    {queueEntries.slice(0, 10).map((entry) => (
                      <li
                        key={entry.position}
                        className="flex items-center gap-3 rounded-md bg-gray-100 px-3 py-2 text-sm dark:bg-white/5"
                      >
                        <span className="font-mono text-xs text-gray-400 dark:text-white/30">
                          #{entry.position}
                        </span>
                        <span className="text-gray-600 dark:text-white/70">
                          {entry.twitchUsername}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-white/40">
                    No one in the queue yet.
                  </p>
                )}
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
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  external?: boolean;
}) {
  const cls = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    active
      ? "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white"
      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/70"
  }`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {icon}
        {label}
        <ExternalLink className="ml-auto h-3 w-3 opacity-40" />
      </a>
    );
  }

  return (
    <Link href={href as Route} className={cls}>
      {icon}
      {label}
    </Link>
  );
}

function formatTimeAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "a month ago";
  return `${months} months ago`;
}
