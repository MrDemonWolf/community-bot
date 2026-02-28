"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Terminal, Users, Radio, ListOrdered, BookOpen, Hash, Timer, Music, Gift } from "lucide-react";

const REFETCH_INTERVAL = 30_000;

export default function QuickStatsCard() {
  const { data: botStatus } = useQuery({
    ...trpc.botChannel.getStatus.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: commands } = useQuery({
    ...trpc.chatCommand.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: regulars } = useQuery({
    ...trpc.regular.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: queueState } = useQuery({
    ...trpc.queue.getState.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: queueEntries } = useQuery({
    ...trpc.queue.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: stats } = useQuery({
    ...trpc.botChannel.stats.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });

  const botChannel = botStatus?.botChannel;
  const statusLabel = !botChannel
    ? "Inactive"
    : botChannel.muted
      ? "Muted"
      : "Active";
  const statusColor = !botChannel
    ? "text-muted-foreground"
    : botChannel.muted
      ? "text-amber-500"
      : "text-green-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Terminal className="size-4" />
            Commands
          </div>
          <span className="text-sm font-medium text-foreground">
            {commands?.length ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            Regulars
          </div>
          <span className="text-sm font-medium text-foreground">
            {regulars?.length ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListOrdered className="size-4" />
            Queue
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium ${
                queueState?.status === "OPEN"
                  ? "text-green-500"
                  : queueState?.status === "PAUSED"
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`}
            >
              {queueState?.status ?? "CLOSED"}
            </span>
            <span className="text-sm font-medium text-foreground">
              {queueEntries?.length ?? 0}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="size-4" />
            Bot Status
          </div>
          <span className={`text-sm font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Extended stats */}
        <div className="border-t border-border pt-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4" />
            Quotes
          </div>
          <span className="text-sm font-medium text-foreground">
            {stats?.quotes ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="size-4" />
            Counters
          </div>
          <span className="text-sm font-medium text-foreground">
            {stats?.counters ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="size-4" />
            Active Timers
          </div>
          <span className="text-sm font-medium text-foreground">
            {stats?.timers ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music className="size-4" />
            Song Requests
          </div>
          <span className="text-sm font-medium text-foreground">
            {stats?.songRequests ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gift className="size-4" />
            Giveaways
          </div>
          <span className="text-sm font-medium text-foreground">
            {stats?.giveaways ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
