import { notFound } from "next/navigation";
import { db, eq, asc, desc, count, users, twitchChannels, botChannels, twitchChatCommands, queueStates, queueEntries, songRequestSettings, songRequests, quotes } from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { ExternalLink, Terminal, Trophy, BookOpen, Music, ChevronRight } from "lucide-react";
import TwitchEmbed from "./twitch-embed";

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
    title: `${user.name}'s Community`,
    description: `${user.name}'s public community profile — stream status, chat commands, and viewer queue.`,
  };
}

async function getProfileData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, broadcasterId),
    with: {
      accounts: {
        columns: { providerId: true, accountId: true },
      },
    },
  });

  if (!user) return null;

  const twitchAccount = user.accounts.find((a) => a.providerId === "twitch");

  let twitchChannel = null;
  if (twitchAccount) {
    twitchChannel = await db.query.twitchChannels.findFirst({
      where: eq(twitchChannels.twitchChannelId, twitchAccount.accountId),
    });
  }

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, user.id),
    columns: { id: true },
  });

  // Count stats
  const [commandCount] = botChannel
    ? await db.select({ value: count() }).from(twitchChatCommands).where(
        eq(twitchChatCommands.botChannelId, botChannel.id),
      )
    : [{ value: 0 }];

  const [quoteCount] = botChannel
    ? await db.select({ value: count() }).from(quotes).where(
        eq(quotes.botChannelId, botChannel.id),
      )
    : [{ value: 0 }];

  const commands = botChannel
    ? await db.query.twitchChatCommands.findMany({
        where: (t, { and: a, eq: e }) =>
          a(e(t.hidden, false), e(t.enabled, true), e(t.botChannelId, botChannel.id)),
        columns: { name: true },
        orderBy: asc(twitchChatCommands.name),
      })
    : [];

  const queueState = await db.query.queueStates.findFirst({
    where: eq(queueStates.id, "singleton"),
  });

  const queueEntryList =
    queueState?.status === "OPEN"
      ? await db.query.queueEntries.findMany({
          orderBy: asc(queueEntries.position),
          columns: { twitchUsername: true, position: true },
        })
      : [];

  const srSettings = botChannel
    ? await db.query.songRequestSettings.findFirst({
        where: eq(songRequestSettings.botChannelId, botChannel.id),
        columns: { enabled: true },
      })
    : null;

  const songRequestList =
    srSettings?.enabled && botChannel
      ? await db.query.songRequests.findMany({
          where: eq(songRequests.botChannelId, botChannel.id),
          orderBy: asc(songRequests.position),
          columns: { id: true, position: true, title: true, requestedBy: true },
          limit: 5,
        })
      : [];

  const quoteList = botChannel
    ? await db.query.quotes.findMany({
        where: eq(quotes.botChannelId, botChannel.id),
        orderBy: desc(quotes.quoteNumber),
        columns: { id: true, quoteNumber: true, text: true },
        limit: 5,
      })
    : [];

  return {
    user,
    twitchChannel,
    commands,
    commandCount: commandCount.value,
    quoteCount: quoteCount.value,
    queueState,
    queueEntries: queueEntryList,
    songRequestsEnabled: srSettings?.enabled ?? false,
    songRequests: songRequestList,
    quotes: quoteList,
  };
}

export default async function PublicPage() {
  const data = await getProfileData();
  if (!data) return notFound();

  const { user, twitchChannel, commands, commandCount, quoteCount, queueState, queueEntries, songRequestsEnabled, songRequests, quotes } = data;
  const isLive = twitchChannel?.isLive ?? false;
  const twitchUsername = twitchChannel?.username;

  const navItems = [
    commands.length > 0 && {
      href: "/p/commands" as const,
      icon: <Terminal className="h-5 w-5" />,
      label: "Commands",
      description: `${commands.length} chat commands available`,
      color: "text-brand-main",
      bgColor: "bg-brand-main/10",
    },
    quotes.length > 0 && {
      href: "/p/quotes" as const,
      icon: <BookOpen className="h-5 w-5" />,
      label: "Quotes",
      description: `${quoteCount} memorable quotes`,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    queueState && queueState.status !== "CLOSED" && {
      href: "/p/queue" as const,
      icon: <Trophy className="h-5 w-5" />,
      label: "Queue",
      description: queueState.status === "OPEN" ? `${queueEntries.length} in queue` : "Queue paused",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    songRequestsEnabled && {
      href: "/p/song-requests" as const,
      icon: <Music className="h-5 w-5" />,
      label: "Song Requests",
      description: `${songRequests.length} song${songRequests.length !== 1 ? "s" : ""} in queue`,
      color: "text-brand-twitch",
      bgColor: "bg-brand-twitch/10",
    },
  ].filter(Boolean) as Array<{
    href: string;
    icon: React.ReactNode;
    label: string;
    description: string;
    color: string;
    bgColor: string;
  }>;

  return (
    <>
      {/* Stream Embed */}
      {twitchUsername && (
        <div className="animate-fade-in-up">
          <TwitchEmbed channel={twitchUsername} isLive={isLive} />
        </div>
      )}

      {/* Stream Status */}
      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card"
        style={{ animationDelay: "100ms" }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-lg font-bold text-foreground">
                <span className="text-brand-main">{user.name}</span> is{" "}
                {isLive ? "live!" : "offline."}
              </h2>
              {twitchChannel?.lastStreamTitle && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {isLive
                    ? twitchChannel.lastStreamTitle
                    : `Last stream: ${twitchChannel.lastStreamTitle}`}
                </p>
              )}
              {!isLive && twitchChannel?.lastGameName && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Playing {twitchChannel.lastGameName}
                  {twitchChannel.lastStartedAt && (
                    <> &middot; {formatTimeAgo(twitchChannel.lastStartedAt)}</>
                  )}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                isLive
                  ? "bg-red-500/15 text-red-500 dark:text-red-400"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {isLive ? "Live" : "Offline"}
            </span>
          </div>
          {twitchUsername && (
            <a
              href={`https://twitch.tv/${twitchUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-twitch/10 px-4 py-2 text-sm font-medium text-brand-twitch transition-colors hover:bg-brand-twitch/20"
            >
              Watch on Twitch
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div
        className="animate-fade-in-up grid grid-cols-2 gap-3 sm:grid-cols-3"
        style={{ animationDelay: "150ms" }}
      >
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-heading text-2xl font-bold text-foreground">{commands.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Commands</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-heading text-2xl font-bold text-foreground">{quoteCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Quotes</p>
        </div>
        <div className="col-span-2 rounded-xl border border-border bg-card p-4 text-center sm:col-span-1">
          <p className="font-heading text-2xl font-bold text-foreground">
            {queueEntries.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">In Queue</p>
        </div>
      </div>

      {/* Navigation Cards */}
      {navItems.length > 0 && (
        <div
          className="animate-fade-in-up grid gap-3 sm:grid-cols-2"
          style={{ animationDelay: "200ms" }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-main/30 hover:shadow-sm"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.bgColor} ${item.color}`}>
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      {/* Recent Quotes */}
      {quotes.length > 0 && (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card"
          style={{ animationDelay: "250ms" }}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3 sm:px-6">
            <h3 className="font-heading text-sm font-semibold text-foreground">Recent Quotes</h3>
            <Link
              href={"/p/quotes" as Route}
              className="text-xs font-medium text-brand-main transition-colors hover:text-brand-main/70"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                className="flex items-start gap-3 px-5 py-3 sm:px-6"
              >
                <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground/60">
                  #{quote.quoteNumber}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{quote.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue Preview */}
      {queueState && queueState.status !== "CLOSED" && (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3 sm:px-6">
            <h3 className="font-heading text-sm font-semibold text-foreground">Viewer Queue</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                queueState.status === "OPEN"
                  ? "bg-green-500/15 text-green-600 dark:text-green-400"
                  : "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
              }`}
            >
              {queueState.status === "OPEN" ? "Open" : "Paused"}
            </span>
          </div>
          <div className="p-5 sm:p-6">
            {queueEntries.length > 0 ? (
              <ol className="space-y-2">
                {queueEntries.slice(0, 10).map((entry) => (
                  <li
                    key={entry.position}
                    className="flex items-center gap-3 rounded-lg bg-surface-raised px-3 py-2 text-sm"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-main/10 font-mono text-xs font-bold text-brand-main">
                      {entry.position}
                    </span>
                    <span className="text-foreground">
                      {entry.twitchUsername}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                No one in the queue yet. Be the first to join!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Song Requests Preview */}
      {songRequestsEnabled && songRequests.length > 0 && (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card"
          style={{ animationDelay: "350ms" }}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3 sm:px-6">
            <h3 className="font-heading text-sm font-semibold text-foreground">Now Playing</h3>
            <Link
              href={"/p/song-requests" as Route}
              className="text-xs font-medium text-brand-main transition-colors hover:text-brand-main/70"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {songRequests.map((song, i) => (
              <div
                key={song.id}
                className="flex items-center gap-3 px-5 py-3 sm:px-6"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-twitch/10 font-mono text-xs font-bold text-brand-twitch">
                  {song.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {song.title}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    requested by {song.requestedBy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
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
