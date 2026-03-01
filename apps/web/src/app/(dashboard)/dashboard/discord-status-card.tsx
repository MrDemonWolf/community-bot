"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Link from "next/link";
import { MessageSquare, ExternalLink } from "lucide-react";

export default function DiscordStatusCard() {
  const { data: guild, isLoading } = useQuery(
    trpc.discordGuild.getStatus.queryOptions()
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Discord</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!guild) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Discord</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No server linked yet.
            </p>
            <Link
              href="/dashboard/discord"
              className="text-sm font-medium text-brand-main hover:underline"
            >
              Link Discord Server
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Discord</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Server info */}
        <div className="flex items-center gap-3">
          {guild.icon ? (
            <Image
              src={guild.icon}
              alt={guild.name ?? "Discord Server"}
              width={36}
              height={36}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-discord/20">
              <MessageSquare className="h-4 w-4 text-brand-discord" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {guild.name}
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  guild.enabled ? "bg-green-500" : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                Notifications {guild.enabled ? "enabled" : "disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Configure link */}
        <Link
          href="/dashboard/discord"
          className="flex items-center gap-1.5 text-xs font-medium text-brand-main hover:underline"
        >
          Configure
          <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
