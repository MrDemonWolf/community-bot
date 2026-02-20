import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import AuditLogFeed from "./audit-log-feed";
import BotControlsCard from "./bot-controls-card";
import QuickStatsCard from "./quick-stats-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-foreground">
        Dashboard
      </h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <AuditLogFeed />
        <div className="space-y-6">
          <BotControlsCard />
          <QuickStatsCard />
        </div>
      </div>
    </div>
  );
}
