"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Trash2,
  Shuffle,
  SkipForward,
  Eraser,
  ListOrdered,
  Play,
  Pause,
  XCircle,
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

const STATUS_CONFIG = {
  OPEN: {
    label: "Open",
    badgeClass: "border-transparent bg-green-500/15 text-green-700 dark:text-green-400",
    buttonClass: "bg-brand-main text-white hover:bg-brand-main/80",
    icon: Play,
  },
  PAUSED: {
    label: "Paused",
    badgeClass: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
    buttonClass: "bg-amber-500 text-white hover:bg-amber-500/80",
    icon: Pause,
  },
  CLOSED: {
    label: "Closed",
    badgeClass: "border-transparent bg-muted text-muted-foreground",
    buttonClass: "bg-muted text-muted-foreground hover:bg-muted/80",
    icon: XCircle,
  },
} as const;

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
        <PageHeader title="Viewer Queue" platforms={["twitch"]} />
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
        <PageHeader title="Viewer Queue" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const status = queueState?.status ?? "CLOSED";
  const statusConfig = STATUS_CONFIG[status];
  const entryCount = entries?.length ?? 0;

  return (
    <div>
      <PageHeader title="Viewer Queue" platforms={["twitch"]}>
        <Badge className={statusConfig.badgeClass}>
          {statusConfig.label}
        </Badge>
      </PageHeader>

      <div className="space-y-4">
        {/* Status Controls */}
        {canManage && (
          <Card>
            <CardContent className="space-y-4 p-4">
              {/* Status Toggle Buttons */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Queue Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((key) => {
                    const config = STATUS_CONFIG[key];
                    const Icon = config.icon;
                    const isActive = status === key;
                    return (
                      <Button
                        key={key}
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className={isActive ? config.buttonClass : ""}
                        onClick={() => setStatusMutation.mutate({ status: key })}
                        disabled={isActive || setStatusMutation.isPending}
                      >
                        <Icon className="size-3.5" />
                        {config.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              {entryCount > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                          {clearMutation.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Eraser className="size-3.5" />
                          )}
                          Confirm Clear
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
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => setClearConfirm(true)}
                      >
                        <Eraser className="size-3.5" />
                        Clear Queue
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Non-manage status display */}
        {!canManage && (
          <Card>
            <CardContent className="flex items-center gap-2 p-4">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge className={statusConfig.badgeClass}>
                {statusConfig.label}
              </Badge>
              <span className="ml-auto text-sm text-muted-foreground">
                {entryCount} {entryCount === 1 ? "viewer" : "viewers"} in queue
              </span>
            </CardContent>
          </Card>
        )}

        {/* Queue Table */}
        {entryCount === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="Queue is empty"
            description="Viewers can join the queue when it is open."
          />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Username
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Joined
                      </th>
                      {canManage && (
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-main/10 text-xs font-bold text-brand-main">
                            {entry.position}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
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
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="divide-y divide-border sm:hidden">
                {entries?.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-4"
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-main/10 text-sm font-bold text-brand-main">
                      {entry.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {entry.twitchUsername}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(new Date(entry.createdAt))}
                      </p>
                    </div>
                    {canManage && (
                      <>
                        {deleteConfirmId === entry.id ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="destructive"
                              size="xs"
                              onClick={() =>
                                removeEntryMutation.mutate({ id: entry.id })
                              }
                              disabled={removeEntryMutation.isPending}
                            >
                              {removeEntryMutation.isPending ? "..." : "Remove"}
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
                            className="shrink-0"
                            onClick={() => setDeleteConfirmId(entry.id)}
                            aria-label={`Remove ${entry.twitchUsername}`}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {entryCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {entryCount} {entryCount === 1 ? "viewer" : "viewers"} in queue
          </p>
        )}
      </div>
    </div>
  );
}
