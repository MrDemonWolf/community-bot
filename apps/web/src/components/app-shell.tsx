"use client";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

type NavItem = { label: string; href?: Route; soon?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Commands", soon: true },
  { label: "Timers", soon: true },
  { label: "Settings", href: "/setup" },
];

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export default function AppShell({
  children,
  userName,
  botName,
}: {
  children: React.ReactNode;
  userName: string;
  botName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-svh bg-[var(--hb-bg)] text-[var(--hb-fg)] [font-family:var(--font-inter)]">
      {/* sidebar */}
      <aside className="flex w-60 flex-none flex-col border-r border-[var(--hb-border)] bg-[var(--hb-sidebar)]/60">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div
            className="grid h-8 w-8 place-items-center rounded-[28%] text-sm font-bold text-[var(--hb-accent-fg)]"
            style={{ background: "var(--hb-accent)" }}
          >
            {(botName || "H")[0].toUpperCase()}
          </div>
          <span className="text-sm font-bold tracking-tight">{botName}</span>
        </div>

        <nav className="flex-1 px-3 py-2">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--hb-subtle)]">
            Manage
          </div>
          <ul className="grid gap-0.5">
            {NAV.map((item) => {
              const active = item.href && pathname === item.href;
              const inner = (
                <>
                  <span>{item.label}</span>
                  {item.soon && (
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-[var(--hb-subtle)]">
                      Soon
                    </span>
                  )}
                </>
              );
              const base =
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors";
              if (item.soon) {
                return (
                  <li key={item.label}>
                    <span className={cx(base, "cursor-not-allowed text-[var(--hb-subtle)]")}>
                      {inner}
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.label}>
                  <Link
                    href={item.href!}
                    className={cx(
                      base,
                      "outline-none focus-visible:ring-2 focus-visible:ring-[var(--hb-accent)]/60",
                      active
                        ? "bg-[var(--hb-accent-soft)] text-[var(--hb-accent)]"
                        : "text-[var(--hb-muted)] hover:bg-white/5 hover:text-[var(--hb-fg)]",
                    )}
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[var(--hb-border)] p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--hb-twitch)]/20 text-xs font-bold uppercase text-[var(--hb-twitch)]">
              {(userName || "?")[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{userName}</div>
              <div className="text-[11px] text-[var(--hb-subtle)]">Broadcaster</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--hb-muted)] outline-none transition-colors hover:bg-white/5 hover:text-[var(--hb-fg)] focus-visible:ring-2 focus-visible:ring-[var(--hb-accent)]/60"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
