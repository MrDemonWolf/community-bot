import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Image from "next/image";
import { User, Terminal, Trophy, Music, BookOpen } from "lucide-react";
import SidebarLink from "./sidebar-link";

async function getLayoutData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const user = await prisma.user.findUnique({
    where: { id: broadcasterId },
    include: {
      accounts: {
        select: { providerId: true, accountId: true },
      },
    },
  });

  if (!user) return null;

  const twitchAccount = user.accounts.find((a) => a.providerId === "twitch");

  let twitchChannel = null;
  if (twitchAccount) {
    twitchChannel = await prisma.twitchChannel.findFirst({
      where: { twitchChannelId: twitchAccount.accountId },
      select: { username: true, isLive: true },
    });
  }

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const hasCommands = botChannel
    ? (await prisma.twitchChatCommand.count({
        where: { hidden: false, enabled: true, botChannelId: botChannel.id },
      })) > 0
    : false;

  const queueState = await prisma.queueState.findFirst({
    where: { id: "singleton" },
    select: { status: true },
  });

  const songRequestSettings = botChannel
    ? await prisma.songRequestSettings.findUnique({
        where: { botChannelId: botChannel.id },
        select: { enabled: true },
      })
    : null;

  const hasQuotes = botChannel
    ? (await prisma.quote.count({ where: { botChannelId: botChannel.id } })) > 0
    : false;

  return {
    user,
    twitchUsername: twitchChannel?.username ?? null,
    isLive: twitchChannel?.isLive ?? false,
    hasCommands,
    hasQuotes,
    queueStatus: queueState?.status ?? "CLOSED",
    songRequestsEnabled: songRequestSettings?.enabled ?? false,
  };
}

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getLayoutData();
  if (!data) return notFound();

  const { user, twitchUsername, isLive, hasCommands, hasQuotes, queueStatus, songRequestsEnabled } = data;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-28 bg-gradient-to-br from-muted via-background to-muted sm:h-48 md:h-56">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE1VjBoLTJWMTVIMTlWMGgtMnYxNUgwdjJoMTd2MTdIMHYyaDE3djE3aDJ2LTE3aDE1djE3aDJWMzZoMTdWMzRIMzZWMTdoMTdWMTVIMzZ6bS0yIDJ2MTdIMTdWMTdoMTd6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:gap-8 sm:flex-row">
          {/* Sidebar */}
          <div className="animate-fade-in-up -mt-16 flex w-full flex-col gap-6 sm:w-64 sm:shrink-0">
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
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {user.name}
                </h1>
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
            </div>

            {/* Nav Links */}
            <nav className="flex flex-row gap-2 sm:flex-col sm:gap-1">
              <SidebarLink
                href="/p"
                icon={<User className="h-4 w-4" />}
                label="Profile"
              />
              {hasCommands && (
                <SidebarLink
                  href="/p/commands"
                  icon={<Terminal className="h-4 w-4" />}
                  label="Commands"
                />
              )}
              {hasQuotes && (
                <SidebarLink
                  href="/p/quotes"
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Quotes"
                />
              )}
              {queueStatus !== "CLOSED" && (
                <SidebarLink
                  href="/p/queue"
                  icon={<Trophy className="h-4 w-4" />}
                  label="Queue"
                />
              )}
              {songRequestsEnabled && (
                <SidebarLink
                  href="/p/song-requests"
                  icon={<Music className="h-4 w-4" />}
                  label="Song Requests"
                />
              )}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 pb-16 pt-4 sm:gap-6 sm:pt-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
