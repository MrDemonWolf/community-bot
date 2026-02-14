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
  User,
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
];

export default function DashboardSidebar({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const pathname = usePathname();
  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                    active
                      ? "bg-brand-twitch/10 font-medium text-brand-twitch"
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
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                botStatus?.hasDiscordLinked
                  ? "bg-green-500"
                  : "bg-muted"
              }`}
            />
            {botStatus?.hasDiscordLinked ? "Connected" : "Not Connected"}
          </div>
        </div>
      </div>
    </aside>
  );
}
