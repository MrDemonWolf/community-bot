"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { getRoleDisplay } from "@/utils/roles";

function getActionDescription(
  action: string,
  metadata: Record<string, unknown> | null
): string {
  switch (action) {
    case "bot.enable":
      return "enabled the bot";
    case "bot.disable":
      return "disabled the bot";
    case "bot.mute":
      return "muted the bot";
    case "bot.unmute":
      return "unmuted the bot";
    case "bot.command-toggles":
      return "updated command toggles";
    case "bot.command-access-level":
      return `changed access level for !${metadata?.commandName ?? "unknown"}`;
    case "command.create":
      return `created command !${metadata?.name ?? "unknown"}`;
    case "command.update":
      return `updated command !${metadata?.name ?? "unknown"}`;
    case "command.delete":
      return `deleted command !${metadata?.name ?? "unknown"}`;
    case "command.toggle":
      return `toggled command !${metadata?.name ?? "unknown"}`;
    case "regular.add":
      return `added ${metadata?.twitchUsername ?? "someone"} as a regular`;
    case "regular.remove":
      return `removed ${metadata?.twitchUsername ?? "someone"} from regulars`;
    case "import.streamelements":
      return `imported ${metadata?.imported ?? 0} commands from StreamElements`;
    case "discord.link":
      return "linked a Discord server";
    case "discord.set-channel":
      return "updated Discord notification channel";
    case "discord.set-role":
      return "updated Discord notification role";
    case "discord.enable":
      return "enabled Discord notifications";
    case "discord.disable":
      return "disabled Discord notifications";
    default:
      return action;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PAGE_SIZE = 25;

export default function AuditLogFeed() {
  const [take, setTake] = useState(PAGE_SIZE);

  const { data, isLoading } = useQuery(
    trpc.auditLog.list.queryOptions({ skip: 0, take })
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = items.length < total;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-heading">Audit Log</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto" style={{ maxHeight: "600px" }}>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            const role = getRoleDisplay(item.userRole, item.isChannelOwner);
            return (
              <div key={item.id} className="flex items-start gap-3">
                {item.userImage ? (
                  <Image
                    src={item.userImage}
                    alt={item.userName}
                    width={32}
                    height={32}
                    className="rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-surface-overlay">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">
                      {item.userName}
                    </span>
                    <span
                      className={`ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-medium ${role.className}`}
                    >
                      {role.label}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getActionDescription(item.action, item.metadata)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setTake((prev) => prev + PAGE_SIZE)}
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
