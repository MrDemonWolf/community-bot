"use client";

import { ArrowUpRight, Gift, LayoutDashboard, LogOut, Puzzle, Settings2, Shield, UserRound } from "lucide-react";
import { canAccess, type Subject } from "@community-bot/core/permissions";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AppShell({
  children,
  userName,
  botName,
  access,
}: {
  children: React.ReactNode;
  userName: string;
  botName: string;
  access: Subject;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <img src="/brand/logo.svg" alt="" width="42" height="42" />
          <span>
            WolfAide<small>YOUR COMMUNITY, CONNECTED</small>
          </span>
        </Link>
        <div className="workspace-label">{access.owner ? "CREATOR WORKSPACE" : "STAFF WORKSPACE"}</div>
        <nav aria-label="Main navigation">
          <Link
            href="/dashboard"
            aria-current={pathname === "/dashboard" ? "page" : undefined}
          >
            <LayoutDashboard size={19} />
            Overview
          </Link>
          {access.owner && <Link
            href="/setup"
            aria-current={pathname === "/setup" ? "page" : undefined}
          >
            <Settings2 size={19} />
            Guided setup
          </Link>}
          {(canAccess(access, "features:manage", "twitch") || canAccess(access, "features:manage", "discord")) && <Link href="/dashboard/features" aria-current={pathname === "/dashboard/features" ? "page" : undefined}><Puzzle size={19} />Features</Link>}
          {canAccess(access, "redemptions:view", "twitch") && <Link href="/dashboard/rewards" aria-current={pathname === "/dashboard/rewards" ? "page" : undefined}><Gift size={19} />Channel points</Link>}
          {access.owner && <Link href="/dashboard/access" aria-current={pathname === "/dashboard/access" ? "page" : undefined}><Shield size={19} />Staff access</Link>}
          <Link href="/access"><UserRound size={19} />My accounts</Link>
          <Link href="/channel" target="_blank">
            <ArrowUpRight size={19} />
            Public channel
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <p className="sidebar-note">
            One creator.
            <br />A little less to manage.
          </p>
          <div className="account">
            <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
            <span>
              {userName}
              <small>{botName}</small>
            </span>
            <button
              title="Sign out"
              aria-label="Sign out"
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <main id="main" className="workspace">
        {children}
      </main>
    </div>
  );
}
