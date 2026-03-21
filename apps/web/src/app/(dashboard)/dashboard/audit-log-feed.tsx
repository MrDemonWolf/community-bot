"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Activity } from "lucide-react";
import { getRoleDisplay } from "@/utils/roles";

function normalizeMetadataValue(value: unknown): string {
  if (value == null) return "unknown";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

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
      return `changed access level for !${normalizeMetadataValue(metadata?.commandName)}`;
    case "command.create":
      return `created command !${normalizeMetadataValue(metadata?.name)}`;
    case "command.update":
      return `updated command !${normalizeMetadataValue(metadata?.name)}`;
    case "command.delete":
      return `deleted command !${normalizeMetadataValue(metadata?.name)}`;
    case "command.toggle":
      return `toggled command !${normalizeMetadataValue(metadata?.name)}`;
    case "regular.add":
      return `added ${normalizeMetadataValue(metadata?.twitchUsername)} as a regular`;
    case "regular.remove":
      return `removed ${normalizeMetadataValue(metadata?.twitchUsername)} from regulars`;
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
      return `created counter "${normalizeMetadataValue(metadata?.name)}"`;
    case "counter.update":
      return `updated counter "${normalizeMetadataValue(metadata?.name)}"`;
    case "counter.delete":
      return `deleted counter "${normalizeMetadataValue(metadata?.name)}"`;
    case "timer.create":
      return `created timer "${normalizeMetadataValue(metadata?.name)}"`;
    case "timer.update":
      return `updated timer "${normalizeMetadataValue(metadata?.name)}"`;
    case "timer.delete":
      return `deleted timer "${normalizeMetadataValue(metadata?.name)}"`;
    case "timer.toggle":
      return `toggled timer "${normalizeMetadataValue(metadata?.name)}"`;
    case "spam-filter.update":
      return "updated spam filter settings";
    case "song-request.skip":
      return `skipped song "${normalizeMetadataValue(metadata?.title)}"`;
    case "song-request.remove":
      return `removed song "${normalizeMetadataValue(metadata?.title)}"`;
    case "song-request.clear":
      return "cleared the song request queue";
    case "song-request.settings-update":
      return "updated song request settings";
    default: {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Activity className="size-4 text-muted-foreground" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 pl-4">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity yet.
          </p>
        )}

        {/* Timeline — scrollable */}
        <div className="relative max-h-[28rem] overflow-y-auto">
          {/* Timeline line */}
          {items.length > 0 && (
            <div className="absolute bottom-0 left-4 top-0 w-px bg-border" />
          )}

          <div className="space-y-0">
            {items.map((item) => {
              const role = getRoleDisplay(item.userRole, item.isChannelOwner);
              return (
                <div
                  key={item.id}
                  className="group relative flex items-start gap-3 rounded-lg py-2.5 pl-4 transition-colors hover:bg-surface-raised"
                >
                  {/* Timeline dot */}
                  <div className="relative z-10 shrink-0">
                    {item.userImage ? (
                      <Image
                        src={item.userImage}
                        alt={item.userName}
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-card"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-surface-overlay ring-2 ring-card">
                        <User className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
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
                      <span className="shrink-0 text-[10px] text-muted-foreground/50">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getActionDescription(item.action, item.metadata)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hasMore && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
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
