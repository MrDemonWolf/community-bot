import { buttonVariants } from "@community-bot/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard")({
  beforeLoad: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(
      context.trpc.settings.get.queryOptions(),
    );
    if (!settings.setupComplete) throw redirect({ to: "/setup" });
  },
  component: Dashboard,
});

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />;
}

function Dashboard() {
  const { data } = useQuery(trpc.settings.get.queryOptions());
  if (!data) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">HowlBot</h1>
        <Link to="/setup" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Settings
        </Link>
      </div>

      <div className="grid gap-4">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Connections</h2>
          <ul className="grid gap-2 text-sm">
            <li className="flex items-center gap-2">
              <StatusDot ok={data.broadcaster.connected} />
              Broadcaster{" "}
              {data.broadcaster.login ? `(${data.broadcaster.login})` : "— not connected"}
            </li>
            <li className="flex items-center gap-2">
              <StatusDot ok={data.bot.connected} />
              Bot {data.bot.login ? `(${data.bot.login})` : "— not connected"}
            </li>
          </ul>
        </section>

        <section className="rounded-lg border p-4 text-sm text-muted-foreground">
          Channel <span className="text-foreground">{data.channelName ?? "—"}</span> · prefix{" "}
          <span className="text-foreground">{data.commandPrefix}</span> · tz{" "}
          <span className="text-foreground">{data.timezone}</span>
        </section>

        <p className="text-sm text-muted-foreground">
          Commands and timers land here next (M1.1 / M1.6).
        </p>
      </div>
    </div>
  );
}
