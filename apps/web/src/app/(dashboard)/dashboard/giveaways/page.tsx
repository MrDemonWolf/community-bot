"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Gift, Plus, Trophy, Users, X, Loader2, Calendar, Trash2 } from "lucide-react";

export default function GiveawaysPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: giveaways, isLoading } = useQuery(
    trpc.giveaway.list.queryOptions()
  );

  const createMutation = useMutation(
    trpc.giveaway.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.giveaway.list.queryKey(),
        });
        setTitle("");
        setKeyword("");
      },
    })
  );

  const drawMutation = useMutation(
    trpc.giveaway.draw.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.giveaway.list.queryKey(),
        });
      },
    })
  );

  const endMutation = useMutation(
    trpc.giveaway.end.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.giveaway.list.queryKey(),
        });
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.giveaway.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.giveaway.list.queryKey(),
        });
        setDeleteConfirmId(null);
      },
    })
  );

  const activeGiveaway = giveaways?.find((g) => g.isActive);
  const pastGiveaways = giveaways?.filter((g) => !g.isActive) ?? [];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Giveaways" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Giveaways"
        platforms={["twitch"]}
        subtitle="Create and manage viewer giveaways."
      />

      <div className="space-y-6">
        {/* Create Form */}
        <Card>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Giveaway title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim() && keyword.trim()) {
                    createMutation.mutate({
                      title: title.trim(),
                      keyword: keyword.trim(),
                    });
                  }
                }}
              />
              <div className="relative sm:w-40">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  #
                </span>
                <Input
                  placeholder="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-6"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim() && keyword.trim()) {
                      createMutation.mutate({
                        title: title.trim(),
                        keyword: keyword.trim(),
                      });
                    }
                  }}
                />
              </div>
              <Button
                className="bg-brand-main text-white hover:bg-brand-main/80"
                onClick={() =>
                  createMutation.mutate({
                    title: title.trim(),
                    keyword: keyword.trim(),
                  })
                }
                disabled={
                  !title.trim() ||
                  !keyword.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Start Giveaway
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Giveaway */}
        {activeGiveaway && (
          <Card className="border-l-4 border-l-brand-main">
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Gift className="size-5 text-brand-main" />
                  <span className="text-sm font-bold text-foreground">
                    {activeGiveaway.title}
                  </span>
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>{activeGiveaway.entryCount} entries</span>
                  </div>
                  <code className="rounded-md bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
                    {activeGiveaway.keyword}
                  </code>
                </div>
              </div>

              {activeGiveaway.winnerName && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2">
                  <Trophy className="size-4 text-yellow-500" />
                  <span className="text-sm font-medium text-foreground">
                    Winner: {activeGiveaway.winnerName}
                  </span>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  className="bg-brand-main text-white hover:bg-brand-main/80"
                  onClick={() => drawMutation.mutate()}
                  disabled={drawMutation.isPending}
                >
                  {drawMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trophy className="size-3.5" />
                  )}
                  Draw Winner
                </Button>
                <Button
                  variant="outline"
                  onClick={() => endMutation.mutate()}
                  disabled={endMutation.isPending}
                >
                  {endMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  End Giveaway
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Past Giveaways
          </p>

          {pastGiveaways.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No past giveaways"
              description="Completed giveaways will appear here."
            />
          ) : (
            <div className="space-y-2">
              {pastGiveaways.map((g) => (
                <Card key={g.id} size="sm">
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gift className="size-4 text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {g.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{g.entryCount} entries</span>
                          <span>·</span>
                          <code className="rounded bg-surface-raised px-1 py-0.5">
                            {g.keyword}
                          </code>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(g.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {g.winnerName && (
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Trophy className="size-3.5 text-yellow-500" />
                          <span>{g.winnerName}</span>
                        </div>
                      )}
                      {deleteConfirmId === g.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate({ id: g.id })}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? "..." : "Confirm"}
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => setDeleteConfirmId(g.id)}
                          aria-label={`Delete ${g.title}`}
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
