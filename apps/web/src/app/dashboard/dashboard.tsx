"use client";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="h-2 w-2 rounded-full"
      style={{ background: ok ? "#2dd4a7" : "var(--hb-subtle)" }}
    />
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--hb-border)] bg-[var(--hb-surface)]/70 p-5 backdrop-blur-xl ${className ?? ""}`}
    >
      <h2 className="mb-3 text-sm font-semibold text-[var(--hb-fg)]">{title}</h2>
      {children}
    </section>
  );
}

export default function Dashboard({ userName }: { userName: string }) {
  const { data } = useQuery(trpc.settings.get.queryOptions());

  const botOnline = Boolean(data?.bot.connected && data?.broadcaster.connected);

  return (
    <>
      {/* topbar */}
      <header className="flex items-center justify-between border-b border-[var(--hb-border)] px-6 py-4">
        <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
        <span className="flex items-center gap-2 rounded-full border border-[var(--hb-border)] bg-[var(--hb-surface)]/60 px-3 py-1.5 text-xs text-[var(--hb-muted)]">
          <StatusDot ok={botOnline} />
          Bot {botOnline ? "online" : "offline"}
        </span>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Welcome back, {userName} 🐺
        </h2>
        <p className="mt-1 text-sm text-[var(--hb-muted)]">
          {data?.channelName ? `Managing #${data.channelName}` : "Finish setup to get started"} ·
          prefix <span className="text-[var(--hb-fg)]">{data?.commandPrefix ?? "!"}</span>
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card title="Connections">
            <ul className="grid gap-2.5 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--hb-muted)]">
                  <StatusDot ok={Boolean(data?.broadcaster.connected)} />
                  Broadcaster
                </span>
                <span className="text-[var(--hb-fg)]">
                  {data?.broadcaster.login ?? "Not connected"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--hb-muted)]">
                  <StatusDot ok={Boolean(data?.bot.connected)} />
                  Bot
                </span>
                <span className="text-[var(--hb-fg)]">{data?.bot.login ?? "Not connected"}</span>
              </li>
            </ul>
          </Card>

          <Card title="At a glance">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Commands" value="0" hint="add in M1.1" />
              <Stat label="Timers" value="0" hint="add in M1.6" />
              <Stat label="Timezone" value={data?.timezone ?? "UTC"} />
              <Stat label="Prefix" value={data?.commandPrefix ?? "!"} />
            </div>
          </Card>
        </div>

        <p className="mt-6 text-sm text-[var(--hb-subtle)]">
          Commands and timers land here next. The chat worker is already listening — try{" "}
          <code className="text-[var(--hb-muted)]">{data?.commandPrefix ?? "!"}ping</code> in chat.
        </p>
      </main>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--hb-subtle)]">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold text-[var(--hb-fg)]">{value}</div>
      {hint && <div className="text-[11px] text-[var(--hb-subtle)]">{hint}</div>}
    </div>
  );
}
