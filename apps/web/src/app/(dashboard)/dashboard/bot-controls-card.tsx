"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Tv,
  VolumeX,
  Volume2,
} from "lucide-react";
import { canControlBot } from "@/utils/roles";

export default function BotControlsCard() {
  const queryClient = useQueryClient();
  const queryKey = trpc.botChannel.getStatus.queryOptions().queryKey;

  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canControl = canControlBot(profile?.role ?? "USER");

  const { data: botStatus, isLoading } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );

  const enableMutation = useMutation(
    trpc.botChannel.enable.mutationOptions({
      onSuccess: () => {
        toast.success("Bot joined your channel!");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const disableMutation = useMutation(
    trpc.botChannel.disable.mutationOptions({
      onSuccess: () => {
        toast.success("Bot left your channel.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const muteMutation = useMutation(
    trpc.botChannel.mute.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.muted ? "Bot muted." : "Bot unmuted.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const hasTwitch = botStatus?.hasTwitchLinked;
  const botChannel = botStatus?.botChannel;
  const isEnabled = botChannel?.enabled;
  const isMuted = botChannel?.muted;
  const isPending =
    enableMutation.isPending ||
    disableMutation.isPending ||
    muteMutation.isPending;

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Twitch Bot</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Not joined */}
        {hasTwitch && !isEnabled && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <AlertCircle className="size-4 text-amber-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Bot is not joined
              </p>
              <p className="text-xs text-muted-foreground">
                {canControl
                  ? "Join the bot to your Twitch channel to get started."
                  : "Bot controls are managed by lead moderators."}
              </p>
              {canControl && (
                <Button
                  size="sm"
                  onClick={() => enableMutation.mutate()}
                  disabled={isPending}
                  className="bg-brand-twitch hover:bg-brand-twitch/80 text-white"
                >
                  {enableMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Tv className="size-4" />
                  )}
                  Join Channel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Muted */}
        {hasTwitch && isEnabled && isMuted && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <VolumeX className="size-4 text-amber-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Bot is muted
              </p>
              <p className="text-xs text-muted-foreground">
                Connected to{" "}
                <a
                  href={`https://twitch.tv/${botChannel.twitchUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-twitch hover:underline"
                >
                  {botChannel.twitchUsername}
                </a>
              </p>
              {canControl ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => muteMutation.mutate({ muted: false })}
                    disabled={isPending}
                  >
                    {muteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                    Unmute
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disableMutation.mutate()}
                    disabled={isPending}
                  >
                    Leave
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Bot controls are managed by lead moderators.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active */}
        {hasTwitch && isEnabled && !isMuted && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="size-4 text-green-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Bot is active
              </p>
              <p className="text-xs text-muted-foreground">
                Connected to{" "}
                <a
                  href={`https://twitch.tv/${botChannel.twitchUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-twitch hover:underline"
                >
                  {botChannel.twitchUsername}
                </a>
              </p>
              {canControl ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => muteMutation.mutate({ muted: true })}
                    disabled={isPending}
                  >
                    {muteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <VolumeX className="size-4" />
                    )}
                    Mute
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disableMutation.mutate()}
                    disabled={isPending}
                  >
                    Leave
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Bot controls are managed by lead moderators.
                </p>
              )}
            </div>
          </div>
        )}

        {!hasTwitch && (
          <p className="text-sm text-muted-foreground">
            Link your Twitch account to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
