"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import {
  BarChart3,
  Plus,
  StopCircle,
  Trash2,
  Loader2,
  Trophy,
  Clock,
} from "lucide-react";

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

  const pastPolls = polls?.filter((p: any) => p.status !== "ACTIVE") ?? [];

  const addChoice = () => {
    if (choices.length < 4) setChoices([...choices, ""]);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 2) setChoices(choices.filter((_, i) => i !== index));
  };

  const canCreate =
    title.trim().length > 0 &&
    choices.filter(Boolean).length >= 2 &&
    !createMutation.isPending;

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Polls"
          platforms={["twitch"]}
          subtitle="Create and manage Twitch polls."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Polls"
        platforms={["twitch"]}
        subtitle="Create and manage Twitch polls."
      />

      <div className="space-y-6">
        {/* Create Poll Form */}
        <Card>
          <CardHeader>
            <CardTitle>New Poll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Poll question..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
            />

            <div className="space-y-2">
              {choices.map((choice, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={choice}
                    onChange={(e) => {
                      const next = [...choices];
                      next[i] = e.target.value;
                      setChoices(next);
                    }}
                    maxLength={25}
                  />
                  {choices.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeChoice(i)}
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {choices.length < 4 && (
                <Button variant="ghost" size="sm" onClick={addChoice}>
                  <Plus className="size-3.5" />
                  Add option
                </Button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Duration:</span>
                <Input
                  type="number"
                  min={15}
                  max={1800}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>

            <Button
              className="bg-brand-main text-white hover:bg-brand-main/80"
              onClick={() =>
                createMutation.mutate({
                  title,
                  choices: choices.filter(Boolean),
                  duration,
                })
              }
              disabled={!canCreate}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create Poll
            </Button>
          </CardContent>
        </Card>

        {/* Active Poll */}
        {activePoll && (
          <ActivePollCard poll={activePoll} onEnd={endMutation} />
        )}

        {/* Past Polls */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Past Polls
          </h2>

          {pastPolls.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No past polls"
              description="Completed polls will appear here."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pastPolls.map((poll: any) => (
                <PastPollCard key={poll.id} poll={poll} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivePollCard({
  poll,
  onEnd,
}: {
  poll: any;
  onEnd: { mutate: (args: { id: string }) => void; isPending: boolean };
}) {
  const totalVotes = poll.choices?.reduce(
    (sum: number, c: any) => sum + (c.votes ?? 0),
    0
  ) ?? 0;

  return (
    <Card className="border-brand-main/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-5 text-brand-main" />
            <CardTitle className="text-base">{poll.title}</CardTitle>
            <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-bold uppercase text-green-600 dark:text-green-400">
              Active
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEnd.mutate({ id: poll.id })}
            disabled={onEnd.isPending}
          >
            {onEnd.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <StopCircle className="size-3.5" />
            )}
            End Poll
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {poll.choices?.map((choice: any) => {
          const pct =
            totalVotes > 0
              ? Math.round(((choice.votes ?? 0) / totalVotes) * 100)
              : 0;
          return (
            <div key={choice.title} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">
                  {choice.title}
                </span>
                <span className="text-muted-foreground">
                  {choice.votes ?? 0} vote{(choice.votes ?? 0) !== 1 ? "s" : ""}{" "}
                  ({pct}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-brand-main transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {totalVotes > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PastPollCard({ poll }: { poll: any }) {
  const totalVotes =
    poll.choices?.reduce(
      (sum: number, c: any) => sum + (c.votes ?? 0),
      0
    ) ?? 0;

  const winner = poll.choices?.reduce(
    (best: any, c: any) =>
      (c.votes ?? 0) > (best?.votes ?? 0) ? c : best,
    null
  );

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{poll.title}</p>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
              poll.status === "COMPLETED"
                ? "bg-green-500/20 text-green-600 dark:text-green-400"
                : "bg-surface-raised text-muted-foreground"
            }`}
          >
            {poll.status === "COMPLETED" ? "Completed" : poll.status}
          </span>
        </div>

        {winner && totalVotes > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-brand-main">
            <Trophy className="size-3" />
            <span className="font-medium">{winner.title}</span>
            <span className="text-muted-foreground">
              ({winner.votes ?? 0} vote{(winner.votes ?? 0) !== 1 ? "s" : ""})
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {poll.choices?.map((c: any) => (
            <span
              key={c.title}
              className={`text-xs ${
                c.title === winner?.title && totalVotes > 0
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {c.title}: {c.votes ?? 0}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
