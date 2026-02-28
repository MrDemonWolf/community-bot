"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Gift, Plus, Trophy, Users, X } from "lucide-react";

export default function GiveawaysPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");

  const { data: giveaways, isLoading } = useQuery(
    trpc.giveaway.list.queryOptions()
  );

  const createMutation = useMutation(
    trpc.giveaway.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.giveaway.list.queryKey() });
        setTitle("");
        setKeyword("");
      },
    })
  );

  const drawMutation = useMutation(
    trpc.giveaway.draw.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.giveaway.list.queryKey() });
      },
    })
  );

  const endMutation = useMutation(
    trpc.giveaway.end.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.giveaway.list.queryKey() });
      },
    })
  );

  const activeGiveaway = giveaways?.find((g) => g.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Giveaways
        </h1>
        <p className="text-sm text-muted-foreground">
          Create and manage viewer giveaways.
        </p>
      </div>

      {/* Create Form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">New Giveaway</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-main focus:outline-none"
          />
          <input
            type="text"
            placeholder="Keyword (e.g. !enter)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-main focus:outline-none sm:w-40"
          />
          <button
            onClick={() =>
              createMutation.mutate({ title, keyword })
            }
            disabled={!title || !keyword || createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-main px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-main/80 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Start
          </button>
        </div>
      </div>

      {/* Active Giveaway */}
      {activeGiveaway && (
        <div className="rounded-xl border-2 border-brand-main/30 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-brand-main" />
              <h2 className="font-semibold text-foreground">
                {activeGiveaway.title}
              </h2>
              <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-bold uppercase text-green-600 dark:text-green-400">
                Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {activeGiveaway.entryCount} entries
              </span>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Keyword: <code className="rounded bg-surface-raised px-1.5 py-0.5">{activeGiveaway.keyword}</code>
          </p>
          {activeGiveaway.winnerName && (
            <p className="mb-4 text-sm font-medium text-foreground">
              <Trophy className="mr-1 inline h-4 w-4 text-yellow-500" />
              Winner: {activeGiveaway.winnerName}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => drawMutation.mutate()}
              disabled={drawMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-main px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-main/80 disabled:opacity-50"
            >
              <Trophy className="h-4 w-4" />
              Draw Winner
            </button>
            <button
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              End
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">History</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !giveaways?.length ? (
          <p className="text-sm text-muted-foreground">No giveaways yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {giveaways
              .filter((g) => !g.isActive)
              .map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {g.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.entryCount} entries · Keyword: {g.keyword}
                    </p>
                  </div>
                  {g.winnerName && (
                    <span className="text-sm text-foreground">
                      <Trophy className="mr-1 inline h-3 w-3 text-yellow-500" />
                      {g.winnerName}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
