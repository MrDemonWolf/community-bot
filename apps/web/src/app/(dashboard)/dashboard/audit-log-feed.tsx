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
import { Skeleton } from "@/components/ui/skeleton";
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
    case "discord.add-channel":
      return "added a monitored Twitch channel to Discord";
    case "discord.remove-channel":
      return "removed a monitored Twitch channel from Discord";
    case "bot.ai-shoutout-enable":
      return "enabled AI-enhanced shoutouts";
    case "bot.ai-shoutout-disable":
      return "disabled AI-enhanced shoutouts";
    case "quote.create":
      return `added quote #${metadata?.number ?? "?"}`;
    case "quote.delete":
      return `deleted quote #${metadata?.number ?? "?"}`;
    case "counter.create":
      return `created counter "${metadata?.name ?? "unknown"}"`;
    case "counter.update":
      return `updated counter "${metadata?.name ?? "unknown"}"`;
    case "counter.delete":
      return `deleted counter "${metadata?.name ?? "unknown"}"`;
    case "timer.create":
      return `created timer "${metadata?.name ?? "unknown"}"`;
    case "timer.update":
      return `updated timer "${metadata?.name ?? "unknown"}"`;
    case "timer.delete":
      return `deleted timer "${metadata?.name ?? "unknown"}"`;
    case "timer.toggle":
      return `toggled timer "${metadata?.name ?? "unknown"}"`;
    case "spam-filter.update":
      return "updated spam filter settings";
    case "song-request.skip":
      return `skipped song "${metadata?.title ?? "unknown"}"`;
    case "song-request.remove":
      return `removed song "${metadata?.title ?? "unknown"}"`;
    case "song-request.clear":
      return "cleared the song request queue";
    case "song-request.settings-update":
      return "updated song request settings";
    default: {
      // Convert dot-separated actions to readable text (e.g., "playlist.create" → "created a playlist")
      const parts = action.split(".");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return action;
    }
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
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
            ))}
          </div>
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
