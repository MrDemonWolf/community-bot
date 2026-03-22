"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  MessageSquare,
  CheckCircle2,
  VolumeX,
  Volume2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { canControlBot } from "@/utils/roles";

export default function DiscordStatusCard() {
  const queryClient = useQueryClient();
  const queryKey = trpc.discordGuild.getStatus.queryOptions().queryKey;

  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canControl = canControlBot(profile?.role ?? "USER");

  const { data: guild, isLoading } = useQuery(
    trpc.discordGuild.getStatus.queryOptions()
  );

  const muteMutation = useMutation(
    trpc.discordGuild.mute.mutationOptions({
      onSuccess: () => {
        toast.success("Discord bot muted.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const unmuteMutation = useMutation(
    trpc.discordGuild.unmute.mutationOptions({
      onSuccess: () => {
        toast.success("Discord bot unmuted.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const isPending = muteMutation.isPending || unmuteMutation.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Discord Bot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!guild) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Discord Bot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground">No server linked</p>
              <p className="text-xs text-muted-foreground">
                Link a Discord server to enable notifications.
              </p>
              <Link
                href="/dashboard/discord"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-main hover:underline"
              >
                Link Discord Server
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isMuted = guild.muted;
  const isEnabled = guild.enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Discord Bot</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Muted state */}
        {isEnabled && isMuted && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <VolumeX className="size-4 text-amber-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                Bot muted in{" "}
                {guild.icon ? (
                  <Image
                    src={guild.icon}
                    alt={guild.name ?? "Discord Server"}
                    width={14}
                    height={14}
                    className="inline rounded-full align-text-bottom"
                    unoptimized
                  />
                ) : null}{" "}
                <span className="font-medium text-foreground">{guild.name}</span>
              </p>
              {canControl ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unmuteMutation.mutate()}
                    disabled={isPending}
                  >
                    {unmuteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                    Unmute
                  </Button>
                  <Link href="/dashboard/discord">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="size-3.5" />
                      Configure
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Bot controls are managed by lead moderators.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active state */}
        {isEnabled && !isMuted && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="size-4 text-green-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                Notifications active in{" "}
                {guild.icon ? (
                  <Image
                    src={guild.icon}
                    alt={guild.name ?? "Discord Server"}
                    width={14}
                    height={14}
                    className="inline rounded-full align-text-bottom"
                    unoptimized
                  />
                ) : null}{" "}
                <span className="font-medium text-foreground">{guild.name}</span>
              </p>
              {canControl ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => muteMutation.mutate()}
                    disabled={isPending}
                  >
                    {muteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <VolumeX className="size-4" />
                    )}
                    Mute
                  </Button>
                  <Link href="/dashboard/discord">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="size-3.5" />
                      Configure
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link
                  href="/dashboard/discord"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-main hover:underline"
                >
                  Configure
                  <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Disabled state */}
        {!isEnabled && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                Notifications disabled for{" "}
                <span className="font-medium text-foreground">{guild.name}</span>
              </p>
              <Link href="/dashboard/discord">
                <Button variant="outline" size="sm">
                  <ExternalLink className="size-3.5" />
                  Configure
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
