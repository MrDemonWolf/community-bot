"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Terminal,
  BookOpen,
  ListOrdered,
  Activity,
  Users,
  Hash,
  Timer,
  Music,
  Gift,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

const REFETCH_INTERVAL = 30_000;

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClass?: string;
}

function StatCard({ icon: Icon, label, value, iconClass }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-main/10">
          <Icon className={`size-5 ${iconClass ?? "text-brand-main"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    OPEN: "bg-green-500/10 text-green-600 dark:text-green-400",
    PAUSED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    CLOSED: "bg-muted text-muted-foreground",
  };
  const colors = colorMap[status] ?? colorMap.CLOSED;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}

const SKELETON_COUNT = 9;

export default function QuickStatsStrip() {
  const { data: botStatus, isLoading: loadingBot } = useQuery({
    ...trpc.botChannel.getStatus.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: commands, isLoading: loadingCmds } = useQuery({
    ...trpc.chatCommand.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: stats, isLoading: loadingStats } = useQuery({
    ...trpc.botChannel.stats.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: queueState, isLoading: loadingQState } = useQuery({
    ...trpc.queue.getState.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });

  const isLoading = loadingBot || loadingCmds || loadingStats || loadingQState;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const botChannel = botStatus?.botChannel;
  const isHealthy = botChannel?.enabled && !botChannel?.muted;
  const queueStatus = queueState?.status ?? "CLOSED";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={Terminal}
        label="Commands"
        value={commands?.length ?? 0}
      />

      <StatCard
        icon={BookOpen}
        label="Quotes"
        value={stats?.quotes ?? 0}
      />

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-main/10">
            <ListOrdered className="size-5 text-brand-main" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Queue</p>
            <QueueBadge status={queueStatus} />
          </div>
        </CardContent>
      </Card>

      <StatCard
        icon={Activity}
        label="Bot Status"
        value={isHealthy ? "Healthy" : "Unhealthy"}
        iconClass={isHealthy ? "text-green-500" : "text-amber-500"}
      />

      <StatCard
        icon={Users}
        label="Regulars"
        value={stats?.regulars ?? 0}
      />

      <StatCard
        icon={Hash}
        label="Counters"
        value={stats?.counters ?? 0}
      />

      <StatCard
        icon={Timer}
        label="Timers"
        value={stats?.timers ?? 0}
      />

      <StatCard
        icon={Music}
        label="Song Requests"
        value={stats?.songRequests ?? 0}
      />

      <StatCard
        icon={Gift}
        label="Giveaways"
        value={stats?.giveaways ?? 0}
      />
    </div>
  );
}
