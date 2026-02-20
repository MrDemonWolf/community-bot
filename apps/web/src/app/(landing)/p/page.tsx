import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
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

export const dynamic = "force-dynamic";

async function getBroadcasterData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const user = await prisma.user.findUnique({
    where: { id: broadcasterId },
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

  let twitchChannel = null;
  if (twitchAccount) {
    twitchChannel = await prisma.twitchChannel.findFirst({
      where: { twitchChannelId: twitchAccount.accountId },
    });
  }

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const commands = botChannel
    ? await prisma.twitchChatCommand.findMany({
        where: { hidden: false, enabled: true, botChannelId: botChannel.id },
        select: { name: true, response: true, accessLevel: true },
        orderBy: { name: "asc" },
      })
    : [];

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
    twitchChannel,
    commands,
    queueState,
    queueEntries,
  };
}

export default async function PublicPage() {
  const data = await getBroadcasterData();

  if (!data) return notFound();

  const { user, twitchChannel, commands, queueState, queueEntries } = data;
  const isLive = twitchChannel?.isLive ?? false;
  const twitchUsername = twitchChannel?.username;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-28 bg-gradient-to-br from-muted via-background to-muted sm:h-48 md:h-56">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE1VjBoLTJWMTVIMTlWMGgtMnYxNUgwdjJoMTd2MTdIMHYyaDE3djE3aDJ2LTE3aDE1djE3aDJWMzZoMTdWMzRIMzZWMTdoMTdWMTVIMzZ6bS0yIDJ2MTdIMTdWMTdoMTd6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:gap-8 sm:flex-row">
          {/* Sidebar */}
          <div className="-mt-16 flex w-full flex-col gap-6 sm:w-64 sm:shrink-0">
            {/* Profile Card */}
            <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-0">
              <div className="relative mb-0 sm:mb-4">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name}
                    width={120}
                    height={120}
                    className="h-[80px] w-[80px] rounded-xl border-4 border-background bg-card sm:h-[120px] sm:w-[120px]"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-[80px] w-[80px] items-center justify-center rounded-xl border-4 border-background bg-card sm:h-[120px] sm:w-[120px]">
                    <User className="h-8 w-8 text-muted-foreground sm:h-12 sm:w-12" />
                  </div>
                )}
                {isLive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-red-500 px-2.5 py-0.5 text-xs font-bold uppercase text-white">
                    Live
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
              {twitchUsername && (
                <a
                  href={`https://twitch.tv/${twitchUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-brand-twitch"
                >
                  twitch.tv/{twitchUsername}
                </a>
              )}
            </div>

            {/* Nav Links */}
            <nav className="flex flex-row gap-2 sm:flex-col sm:gap-1">
              <SidebarLink
                href="/p"
                icon={<User className="h-4 w-4" />}
                label="Profile"
                active
              />
              {commands.length > 0 && (
                <SidebarLink
                  href="/p/commands"
                  icon={<Terminal className="h-4 w-4" />}
                  label="Commands"
                />
              )}
              {queueState?.status !== "CLOSED" && (
                <SidebarLink
                  href="/p/queue"
                  icon={<Trophy className="h-4 w-4" />}
                  label="Queue"
                />
              )}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 pb-16 pt-4 sm:gap-6 sm:pt-6">
            {/* Twitch Embed */}
            {twitchUsername && (
              <TwitchEmbed channel={twitchUsername} isLive={isLive} />
            )}

            {/* Stream Status Card */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="p-6">
                <span
                  className={`mb-3 inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                    isLive
                      ? "bg-red-500/20 text-red-500 dark:text-red-400"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {isLive ? "Live" : "Offline"}
                </span>
                <h2 className="text-lg font-bold text-foreground">
                  <span className="text-brand-main">{user.name}</span> is{" "}
                  {isLive ? "live!" : "offline."}
                </h2>
                {twitchChannel?.lastStreamTitle && (
                  <p className="mt-2 text-muted-foreground">
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
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-twitch transition-colors hover:text-brand-twitch/80"
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
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Chat Commands</h3>
                  <Link
                    href={"/p/commands" as Route}
                    className="text-sm text-brand-main transition-colors hover:text-brand-main/70"
                  >
                    View all
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {commands.slice(0, 12).map((cmd) => (
                    <span
                      key={cmd.name}
                      className="rounded-md bg-surface-raised px-2.5 py-1 text-sm text-muted-foreground"
                    >
                      !{cmd.name}
                    </span>
                  ))}
                  {commands.length > 12 && (
                    <span className="rounded-md bg-surface-raised px-2.5 py-1 text-sm text-muted-foreground/70">
                      +{commands.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Queue */}
            {queueState && queueState.status !== "CLOSED" && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Viewer Queue</h3>
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
                        className="flex items-center gap-3 rounded-md bg-surface-raised px-3 py-2 text-sm"
                      >
                        <span className="font-mono text-xs text-muted-foreground/70">
                          #{entry.position}
                        </span>
                        <span className="text-muted-foreground">
                          {entry.twitchUsername}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
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
      ? "bg-surface-raised text-foreground"
      : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
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
