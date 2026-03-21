import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import { PageHeader } from "@/components/page-header";
import AuditLogFeed from "./audit-log-feed";
import BotControlsCard from "./bot-controls-card";
import DiscordStatusCard from "./discord-status-card";
import QuickStatsStrip from "./quick-stats-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      {/* Quick Stats Row */}
      <QuickStatsStrip />

      {/* Bot controls + Discord side-by-side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BotControlsCard />
        <DiscordStatusCard />
      </div>

      {/* Audit Log Feed */}
      <AuditLogFeed />
    </div>
  );
}
