"use client";
import { authClient } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Tv,
  VolumeX,
  Volume2,
} from "lucide-react";

export default function Dashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const queryClient = useQueryClient();
  const queryKey = trpc.botChannel.getStatus.queryOptions().queryKey;

  const { data: botStatus, isLoading: botLoading } = useQuery(
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

  if (botLoading) return null;

  // State 1: Not joined
  if (hasTwitch && !isEnabled) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-4 pt-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <AlertCircle className="size-5 text-amber-500" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Bot is not joined to your Twitch channel!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Join the bot to your Twitch channel to allow it to respond to
                  commands, moderate your chat, and engage with your community.
                </p>
              </div>
              <Button
                onClick={() => enableMutation.mutate()}
                disabled={isPending}
                className="bg-[#9146FF] hover:bg-[#7c3aed] text-white"
              >
                {enableMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Tv className="size-4" />
                )}
                JOIN TWITCH CHANNEL
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 3: Muted
  if (hasTwitch && isEnabled && isMuted) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <VolumeX className="size-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Bot is MUTED in your channel
                </h3>
                <p className="text-sm text-muted-foreground">
                  Connected to{" "}
                  <a
                    href={`https://twitch.tv/${botChannel.twitchUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#9146FF] hover:underline"
                  >
                    {botChannel.twitchUsername}
                  </a>{" "}
                  (muted)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                {disableMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Leave
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State 2: Active
  if (hasTwitch && isEnabled) {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="size-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Bot is active in your channel
                </h3>
                <p className="text-sm text-muted-foreground">
                  Connected to{" "}
                  <a
                    href={`https://twitch.tv/${botChannel.twitchUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#9146FF] hover:underline"
                  >
                    {botChannel.twitchUsername}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                {disableMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Leave
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
