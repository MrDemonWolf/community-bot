import { notFound } from "next/navigation";
import { db, eq, asc, desc, users, twitchChannels, botChannels, twitchChatCommands, queueStates, queueEntries, songRequestSettings, songRequests, quotes } from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
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

  const { user, twitchChannel, commands, queueState, queueEntries, songRequestsEnabled, songRequests, quotes } = data;
  const isLive = twitchChannel?.isLive ?? false;
  const twitchUsername = twitchChannel?.username;

  return (
    <>
      {/* Twitch Embed */}
      {twitchUsername && (
        <div className="animate-fade-in-up">
          <TwitchEmbed channel={twitchUsername} isLive={isLive} />
        </div>
      )}

      {/* Stream Status Card */}
      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card"
        style={{ animationDelay: "100ms" }}
      >
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
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6"
          style={{ animationDelay: "200ms" }}
        >
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

      {/* Quotes Preview */}
      {quotes.length > 0 && (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6"
          style={{ animationDelay: "250ms" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Quotes</h3>
            <Link
              href={"/p/quotes" as Route}
              className="text-sm text-brand-main transition-colors hover:text-brand-main/70"
            >
              View all
            </Link>
          </div>
          <ol className="space-y-2">
            {quotes.map((quote) => (
              <li
                key={quote.id}
                className="flex items-center gap-3 rounded-md bg-surface-raised px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground/70">
                  #{quote.quoteNumber}
                </span>
                <span className="truncate text-muted-foreground">
                  &ldquo;{quote.text}&rdquo;
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Queue */}
      {queueState && queueState.status !== "CLOSED" && (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6"
          style={{ animationDelay: "300ms" }}
        >
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

      {/* Song Requests */}
      {songRequestsEnabled && songRequests.length > 0 && (
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6"
          style={{ animationDelay: "400ms" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Song Requests</h3>
            <Link
              href={"/p/song-requests" as Route}
              className="text-sm text-brand-main transition-colors hover:text-brand-main/70"
            >
              View all
            </Link>
          </div>
          <ol className="space-y-2">
            {songRequests.map((song) => (
              <li
                key={song.id}
                className="flex items-center gap-3 rounded-md bg-surface-raised px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground/70">
                  #{song.position}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="truncate text-foreground">{song.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    — {song.requestedBy}
                  </span>
                </div>
              </li>
            ))}
          </ol>
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
