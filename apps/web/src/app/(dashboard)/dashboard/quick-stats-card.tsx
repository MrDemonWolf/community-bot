"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Terminal, Users, Radio, ListOrdered } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const REFETCH_INTERVAL = 30_000;

export default function QuickStatsStrip() {
  const { data: botStatus, isLoading: loadingBot } = useQuery({
    ...trpc.botChannel.getStatus.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: commands, isLoading: loadingCmds } = useQuery({
    ...trpc.chatCommand.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: regulars, isLoading: loadingRegs } = useQuery({
    ...trpc.regular.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: queueState, isLoading: loadingQState } = useQuery({
    ...trpc.queue.getState.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: queueEntries, isLoading: loadingQEntries } = useQuery({
    ...trpc.queue.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });

  const isLoading =
    loadingBot || loadingCmds || loadingRegs || loadingQState || loadingQEntries;

  const botChannel = botStatus?.botChannel;
  const statusLabel = !botChannel
    ? "Inactive"
    : botChannel.muted
      ? "Muted"
      : "Active";
  const statusBorder = !botChannel
    ? "border-l-muted-foreground/30"
    : botChannel.muted
      ? "border-l-amber-500"
      : "border-l-green-500";
  const statusColor = !botChannel
    ? "text-muted-foreground"
    : botChannel.muted
      ? "text-amber-500"
      : "text-green-500";

  const queueStatus = queueState?.status ?? "CLOSED";
  const queueBorder =
    queueStatus === "OPEN"
      ? "border-l-green-500"
      : queueStatus === "PAUSED"
        ? "border-l-amber-500"
        : "border-l-muted-foreground/30";

  const stats = [
    {
      icon: Terminal,
      label: "Commands",
      value: commands?.length ?? 0,
      borderClass: "border-l-brand-main",
    },
    {
      icon: Users,
      label: "Regulars",
      value: regulars?.length ?? 0,
      borderClass: "border-l-brand-main",
    },
    {
      icon: ListOrdered,
      label: "Queue",
      value: `${queueStatus} (${queueEntries?.length ?? 0})`,
      borderClass: queueBorder,
    },
    {
      icon: Radio,
      label: "Bot",
      value: statusLabel,
      valueClass: statusColor,
      borderClass: statusBorder,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-lg border-l-3 border-l-muted p-3">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`glass rounded-lg border-l-3 p-3 ${stat.borderClass}`}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <stat.icon className="size-3.5" />
            {stat.label}
          </div>
          <p className={`mt-1 text-lg font-bold ${stat.valueClass ?? "text-foreground"}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
