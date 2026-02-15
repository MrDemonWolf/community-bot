"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Terminal, Users, Radio } from "lucide-react";

export default function QuickStatsCard() {
  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: commands } = useQuery(
    trpc.chatCommand.list.queryOptions()
  );
  const { data: regulars } = useQuery(
    trpc.regular.list.queryOptions()
  );

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
            <Radio className="size-4" />
            Bot Status
          </div>
          <span className={`text-sm font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
