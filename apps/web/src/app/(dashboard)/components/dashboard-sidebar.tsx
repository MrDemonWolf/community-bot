"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import type { Route } from "next";
import {
  LayoutDashboard,
  Terminal,
  Users,
  Home,
  MessageSquare,
  UserCog,
  ListOrdered,
  Quote,
  Hash,
  Timer,
  Shield,
  Gavel,
  Flag,
  Music,
  ListMusic,
  Gift,
  BarChart3,
  ChevronRight,
  FileText,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  suffix?: React.ReactNode;
}

interface NavGroup {
  key: string;
  label: string;
  links: NavLink[];
}

const STORAGE_KEY = "sidebar-collapsed";

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

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const discordDot = (
    <span
      className={`ml-auto h-2 w-2 rounded-full ${
        botStatus?.hasDiscordLinked ? "bg-green-500" : "bg-muted-foreground/30"
      }`}
    />
  );

  const groups: NavGroup[] = [
    {
      key: "chat",
      label: "Chat",
      links: [
        { href: "/dashboard/commands", label: "Commands", icon: Terminal },
        { href: "/dashboard/regulars", label: "Regulars", icon: Users },
        { href: "/dashboard/moderation", label: "Moderation", icon: Shield },
        { href: "/dashboard/quotes", label: "Quotes", icon: Quote },
      ],
    },
    {
      key: "interactive",
      label: "Interactive",
      links: [
        { href: "/dashboard/queue", label: "Queue", icon: ListOrdered },
        { href: "/dashboard/giveaways", label: "Giveaways", icon: Gift },
        { href: "/dashboard/polls", label: "Polls", icon: BarChart3 },
      ],
    },
    {
      key: "features",
      label: "Features",
      links: [
        { href: "/dashboard/counters", label: "Counters", icon: Hash },
        { href: "/dashboard/timers", label: "Timers", icon: Timer },
        { href: "/dashboard/song-requests", label: "Song Requests", icon: Music },
        { href: "/dashboard/playlists", label: "Playlists", icon: ListMusic },
      ],
    },
    {
      key: "discord",
      label: "Discord Bot",
      links: [
        {
          href: "/dashboard/discord",
          label: "Settings",
          icon: MessageSquare,
          exact: true,
          suffix: discordDot,
        },
        {
          href: "/dashboard/discord/templates",
          label: "Templates",
          icon: FileText,
        },
        {
          href: "/dashboard/discord/scheduled",
          label: "Scheduled",
          icon: Clock,
        },
        {
          href: "/dashboard/discord/roles",
          label: "Role Panels",
          icon: ShieldCheck,
        },
        {
          href: "/dashboard/discord/moderation",
          label: "Moderation",
          icon: Gavel,
        },
        {
          href: "/dashboard/discord/custom-commands",
          label: "Custom Commands",
          icon: Terminal,
        },
        {
          href: "/dashboard/discord/reports",
          label: "Reports",
          icon: Flag,
        },
      ],
    },
    ...(isBroadcaster
      ? [
          {
            key: "management",
            label: "Management",
            links: [
              { href: "/dashboard/users", label: "Users", icon: UserCog },
            ],
          },
        ]
      : []),
  ];

  // Initialize collapsed state from localStorage
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCollapsed(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const persistCollapsed = useCallback((next: Record<string, boolean>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const toggleGroup = (key: string) => {
    persistCollapsed({ ...collapsed, [key]: !collapsed[key] });
  };

  // Check if a group should be expanded because the current path matches
  const isGroupActive = (group: NavGroup) =>
    group.links.some((link) => isActive(link.href, link.exact));

  const isExpanded = (group: NavGroup) =>
    isGroupActive(group) || !collapsed[group.key];

  return (
    <div className="flex h-full flex-col p-3">
      {/* Dashboard link (standalone) */}
      <nav className="mb-1 flex flex-col">
        <Link
          href={"/dashboard" as Route}
          onClick={onNavigate}
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
            isActive("/dashboard", true)
              ? "border-l-3 border-brand-main bg-brand-main/10 pl-2.5 font-medium text-brand-main"
              : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
      </nav>

      {/* Grouped sections */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {groups.map((group) => {
          const expanded = isExpanded(group);
          return (
            <div key={group.key} className="mt-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <ChevronRight
                  className={`size-3 transition-transform duration-200 ${
                    expanded ? "rotate-90" : ""
                  }`}
                />
                {group.label}
              </button>
              {expanded && (
                <nav className="mt-0.5 flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const active = isActive(link.href, link.exact);
                    return (
                      <Link
                        key={link.href}
                        href={link.href as Route}
                        onClick={onNavigate}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
                          active
                            ? "border-l-3 border-brand-main bg-brand-main/10 pl-2.5 font-medium text-brand-main"
                            : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                        }`}
                      >
                        <link.icon className="size-4" />
                        {link.label}
                        {link.suffix}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-border pt-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <Home className="size-4" />
          Back to Home
        </Link>
        <span className="mt-1 block px-3 text-[10px] text-muted-foreground/40">
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"}
          {process.env.NEXT_PUBLIC_GIT_SHA
            ? ` · ${process.env.NEXT_PUBLIC_GIT_SHA}`
            : ""}
        </span>
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
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-card/80 lg:block">
      <SidebarContent session={session} />
    </aside>
  );
}
