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
    <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-gray-50/50 dark:border-white/10 dark:bg-[#091533] lg:block">
      <div className="flex h-full flex-col gap-6 p-5">
        {/* User info */}
        <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-white/5">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-white/10">
              <User className="h-5 w-5 text-gray-400 dark:text-white/40" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {session.user.name}
            </p>
            {botStatus?.botChannel?.twitchUsername && (
              <p className="truncate text-xs text-gray-500 dark:text-white/40">
                {botStatus.botChannel.twitchUsername}
              </p>
            )}
          </div>
        </div>

        {/* Twitch section */}
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30">
            Twitch
          </p>
          <nav className="flex flex-col gap-0.5">
            {twitchLinks.map((link) => {
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href as Route}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[#9146FF]/10 font-medium text-[#9146FF] dark:bg-[#9146FF]/20 dark:text-[#b380ff]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
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
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30">
            Discord
          </p>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-white/60">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                botStatus?.hasDiscordLinked
                  ? "bg-green-500"
                  : "bg-gray-300 dark:bg-white/20"
              }`}
            />
            {botStatus?.hasDiscordLinked ? "Connected" : "Not Connected"}
          </div>
        </div>
      </div>
    </aside>
  );
}
