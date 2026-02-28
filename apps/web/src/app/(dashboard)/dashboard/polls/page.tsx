"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { BarChart3, Plus, StopCircle } from "lucide-react";

export default function PollsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [duration, setDuration] = useState(60);

  const { data: polls, isLoading } = useQuery(
    trpc.poll.list.queryOptions()
  );

  const createMutation = useMutation(
    trpc.poll.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.poll.list.queryKey() });
        setTitle("");
        setChoices(["", ""]);
        setDuration(60);
      },
    })
  );

  const endMutation = useMutation(
    trpc.poll.end.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.poll.list.queryKey() });
      },
    })
  );

  const activePoll = polls?.find(
    (p: any) => p.status === "ACTIVE"
  ) as any;

  const addChoice = () => {
    if (choices.length < 5) setChoices([...choices, ""]);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 2) setChoices(choices.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Polls
        </h1>
        <p className="text-sm text-muted-foreground">
          Create and manage Twitch polls.
        </p>
      </div>

      {/* Create Form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">New Poll</h2>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Question"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-main focus:outline-none"
          />
          {choices.map((choice, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                value={choice}
                onChange={(e) => {
                  const next = [...choices];
                  next[i] = e.target.value;
                  setChoices(next);
                }}
                maxLength={25}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-main focus:outline-none"
              />
              {choices.length > 2 && (
                <button
                  onClick={() => removeChoice(i)}
                  className="rounded-lg border border-border px-2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            {choices.length < 5 && (
              <button
                onClick={addChoice}
                className="text-sm text-brand-main hover:text-brand-main/80"
              >
                + Add option
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Duration:</label>
              <input
                type="number"
                min={15}
                max={1800}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-brand-main focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>
          <button
            onClick={() =>
              createMutation.mutate({
                title,
                choices: choices.filter(Boolean),
                duration,
              })
            }
            disabled={
              !title ||
              choices.filter(Boolean).length < 2 ||
              createMutation.isPending
            }
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand-main px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-main/80 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Create Poll
          </button>
        </div>
      </div>

      {/* Active Poll */}
      {activePoll && (
        <div className="rounded-xl border-2 border-brand-main/30 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-brand-main" />
              <h2 className="font-semibold text-foreground">
                {activePoll.title}
              </h2>
              <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-bold uppercase text-green-600 dark:text-green-400">
                Active
              </span>
            </div>
            <button
              onClick={() =>
                endMutation.mutate({ id: activePoll.id })
              }
              disabled={endMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
            >
              <StopCircle className="h-4 w-4" />
              End Poll
            </button>
          </div>
          <div className="space-y-2">
            {activePoll.choices?.map((choice: any) => {
              const totalVotes = activePoll.choices.reduce(
                (sum: number, c: any) => sum + (c.votes ?? 0),
                0
              );
              const pct =
                totalVotes > 0
                  ? Math.round(((choice.votes ?? 0) / totalVotes) * 100)
                  : 0;
              return (
                <div key={choice.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{choice.title}</span>
                    <span className="text-muted-foreground">
                      {choice.votes ?? 0} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-brand-main transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Poll History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">History</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !polls?.length ? (
          <p className="text-sm text-muted-foreground">No polls yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {polls
              .filter((p: any) => p.status !== "ACTIVE")
              .map((p: any) => (
                <div key={p.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {p.title}
                    </p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                        p.status === "COMPLETED"
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : "bg-surface-raised text-muted-foreground"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3">
                    {p.choices?.map((c: any) => (
                      <span
                        key={c.id}
                        className="text-xs text-muted-foreground"
                      >
                        {c.title}: {c.votes ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
