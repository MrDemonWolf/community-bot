"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import type { Route } from "next";
import {
  LayoutDashboard,
  Terminal,
  Users,
  Settings,
  User,
  Home,
  MessageSquare,
  UserCog,
  ListOrdered,
  Quote,
  Hash,
  Timer,
  Shield,
  Music,
} from "lucide-react";

const twitchLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/commands",
    label: "Commands",
    icon: Terminal,
    exact: false,
  },
  {
    href: "/dashboard/regulars",
    label: "Regulars",
    icon: Users,
    exact: false,
  },
  {
    href: "/dashboard/queue",
    label: "Queue",
    icon: ListOrdered,
    exact: false,
  },
  {
    href: "/dashboard/quotes",
    label: "Quotes",
    icon: Quote,
    exact: false,
  },
  {
    href: "/dashboard/counters",
    label: "Counters",
    icon: Hash,
    exact: false,
  },
  {
    href: "/dashboard/timers",
    label: "Timers",
    icon: Timer,
    exact: false,
  },
  {
    href: "/dashboard/song-requests",
    label: "Song Requests",
    icon: Music,
    exact: false,
  },
  {
    href: "/dashboard/moderation",
    label: "Moderation",
    icon: Shield,
    exact: false,
  },
];

export function SidebarContent({
  session,
  onNavigate,
}: {
  session: typeof authClient.$Infer.Session;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());

  const isBroadcaster = profile?.role === "BROADCASTER";

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      {/* User info */}
      <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name}
            width={40}
            height={40}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {session.user.name}
          </p>
          {botStatus?.botChannel?.twitchUsername && (
            <p className="truncate text-xs text-muted-foreground">
              {botStatus.botChannel.twitchUsername}
            </p>
          )}
        </div>
      </div>

      {/* Twitch section */}
      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Twitch
        </p>
        <nav className="flex flex-col gap-0.5">
          {twitchLinks.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href as Route}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading transition-all duration-200 ${
                  active
                    ? "bg-brand-main/10 font-medium text-brand-main"
                    : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Discord section */}
      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Discord
        </p>
        <nav className="flex flex-col gap-0.5">
          <Link
            href={"/dashboard/discord" as Route}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading transition-all duration-200 ${
              pathname.startsWith("/dashboard/discord")
                ? "bg-brand-main/10 font-medium text-brand-main"
                : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Settings
            <span
              className={`ml-auto h-2 w-2 rounded-full ${
                botStatus?.hasDiscordLinked ? "bg-green-500" : "bg-muted"
              }`}
            />
          </Link>
        </nav>
      </div>

      {/* Management section — BROADCASTER only */}
      {isBroadcaster && (
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Management
          </p>
          <nav className="flex flex-col gap-0.5">
            <Link
              href={"/dashboard/users" as Route}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading transition-all duration-200 ${
                pathname.startsWith("/dashboard/users")
                  ? "bg-brand-main/10 font-medium text-brand-main"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              <UserCog className="h-4 w-4" />
              Users
            </Link>
          </nav>
        </div>
      )}

      {/* Settings */}
      <div>
        <nav className="flex flex-col gap-0.5">
          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading transition-all duration-200 ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-brand-main/10 font-medium text-brand-main"
                : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
      </div>

      {/* Back to Home */}
      <div className="mt-auto">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
      <SidebarContent session={session} />
    </aside>
  );
}
