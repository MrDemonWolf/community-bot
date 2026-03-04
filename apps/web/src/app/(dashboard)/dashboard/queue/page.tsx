"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Trash2,
  Shuffle,
  SkipForward,
  Eraser,
  ListOrdered,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function QueuePage() {
  const queryClient = useQueryClient();
  const stateQueryKey = trpc.queue.getState.queryOptions().queryKey;
  const listQueryKey = trpc.queue.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: queueState, isLoading: stateLoading } = useQuery(
    trpc.queue.getState.queryOptions()
  );
  const { data: entries, isLoading: entriesLoading } = useQuery(
    trpc.queue.list.queryOptions()
  );

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: stateQueryKey });
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const setStatusMutation = useMutation(
    trpc.queue.setStatus.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Queue is now ${data.status.toLowerCase()}.`);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeEntryMutation = useMutation(
    trpc.queue.removeEntry.mutationOptions({
      onSuccess: () => {
        toast.success("Entry removed from queue.");
        invalidateAll();
        setDeleteConfirmId(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const pickEntryMutation = useMutation(
    trpc.queue.pickEntry.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Picked: ${data.twitchUsername}`);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const clearMutation = useMutation(
    trpc.queue.clear.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Cleared ${data.cleared} entries from queue.`);
        invalidateAll();
        setClearConfirm(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Queue" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage the queue.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stateLoading || entriesLoading) {
    return (
      <div>
        <PageHeader title="Queue" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const status = queueState?.status ?? "CLOSED";

  return (
    <div>
      <PageHeader title="Queue" platforms={["twitch"]} />

      <div className="space-y-4">
        {/* Status Controls */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() =>
                  setStatusMutation.mutate({ status: "OPEN" })
                }
                disabled={
                  status === "OPEN" || setStatusMutation.isPending
                }
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  status === "OPEN"
                    ? "bg-green-500/20 text-green-400"
                    : "text-muted-foreground hover:bg-surface-raised"
                } disabled:cursor-not-allowed`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatusMutation.mutate({ status: "PAUSED" })
                }
                disabled={
                  status === "PAUSED" || setStatusMutation.isPending
                }
                className={`border-x border-border px-4 py-2 text-sm font-medium transition-colors ${
                  status === "PAUSED"
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-muted-foreground hover:bg-surface-raised"
                } disabled:cursor-not-allowed`}
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatusMutation.mutate({ status: "CLOSED" })
                }
                disabled={
                  status === "CLOSED" || setStatusMutation.isPending
                }
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  status === "CLOSED"
                    ? "bg-muted-foreground/20 text-muted-foreground"
                    : "text-muted-foreground hover:bg-surface-raised"
                } disabled:cursor-not-allowed`}
              >
                Close
              </button>
            </div>

            {/* Action Buttons */}
            {(entries?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => pickEntryMutation.mutate({ mode: "next" })}
                  disabled={pickEntryMutation.isPending}
                >
                  <SkipForward className="size-3.5" />
                  Pick Next
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pickEntryMutation.mutate({ mode: "random" })}
                  disabled={pickEntryMutation.isPending}
                >
                  <Shuffle className="size-3.5" />
                  Pick Random
                </Button>
                {clearConfirm ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => clearMutation.mutate()}
                      disabled={clearMutation.isPending}
                    >
                      {clearMutation.isPending ? "..." : "Confirm Clear"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setClearConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => setClearConfirm(true)}
                  >
                    <Eraser className="size-3.5" />
                    Clear Queue
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Non-manage status display */}
        {!canManage && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status === "OPEN"
                  ? "bg-green-500/15 text-green-500"
                  : status === "PAUSED"
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-muted-foreground/15 text-muted-foreground"
              }`}
            >
              {status === "OPEN"
                ? "Open"
                : status === "PAUSED"
                  ? "Paused"
                  : "Closed"}
            </span>
          </div>
        )}

        {/* Queue Table */}
        {(entries?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="Queue is empty."
            description="Viewers can join the queue when it is open."
          />
        ) : (
          <div className="glass overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Username
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Joined
                  </th>
                  {canManage && (
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries?.map((entry) => (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-foreground">
                        {entry.position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-brand-main">
                      {entry.twitchUsername}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {relativeTime(new Date(entry.createdAt))}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {deleteConfirmId === entry.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="destructive"
                              size="xs"
                              onClick={() =>
                                removeEntryMutation.mutate({
                                  id: entry.id,
                                })
                              }
                              disabled={removeEntryMutation.isPending}
                            >
                              {removeEntryMutation.isPending
                                ? "..."
                                : "Confirm"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeleteConfirmId(entry.id)}
                            aria-label={`Remove ${entry.twitchUsername}`}
                          >
                            <Trash2 className="size-3.5 text-red-400" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
