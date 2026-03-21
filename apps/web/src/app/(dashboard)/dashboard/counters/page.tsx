"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Trash2,
  Minus,
  Plus,
  Hash,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function CountersPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.counter.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: counters, isLoading } = useQuery(
    trpc.counter.list.queryOptions()
  );

  const [newCounterName, setNewCounterName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [setValueInputs, setSetValueInputs] = useState<
    Record<string, string>
  >({});

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const createMutation = useMutation(
    trpc.counter.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Counter "${data.name}" created.`);
        setNewCounterName("");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.counter.update.mutationOptions({
      onSuccess: () => {
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.counter.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Counter deleted.");
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Counters" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage counters.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Counters" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Counters" platforms={["twitch"]}>
        {canManage && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Counter name..."
              value={newCounterName}
              onChange={(e) => setNewCounterName(e.target.value)}
              className="w-48"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCounterName.trim()) {
                  createMutation.mutate({ name: newCounterName.trim() });
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (newCounterName.trim()) {
                  createMutation.mutate({ name: newCounterName.trim() });
                }
              }}
              disabled={!newCounterName.trim() || createMutation.isPending}
            >
              <Plus className="size-3.5" />
              Create Counter
            </Button>
          </div>
        )}
      </PageHeader>

      <p className="mb-6 text-sm text-muted-foreground">
        Use{" "}
        <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs font-medium">
          {"{counter_name}"}
        </code>{" "}
        in command responses to display the counter value.
      </p>

      {(counters?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Hash}
          title="No counters yet"
          description="Create one above to start tracking."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {counters?.map((c) => (
            <Card key={c.id} className="glass group relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Hash className="size-3.5 text-brand-main/60" />
                  {c.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Large counter value */}
                <div className="flex items-center justify-center py-2">
                  <span className="font-heading text-5xl font-bold text-brand-main">
                    {c.value}
                  </span>
                </div>

                {/* Increment / Decrement buttons */}
                {canManage && (
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        updateMutation.mutate({
                          id: c.id,
                          value: c.value - 1,
                        })
                      }
                      disabled={updateMutation.isPending}
                      aria-label={`Decrement ${c.name}`}
                      className="size-10 rounded-full"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        updateMutation.mutate({
                          id: c.id,
                          value: c.value + 1,
                        })
                      }
                      disabled={updateMutation.isPending}
                      aria-label={`Increment ${c.name}`}
                      className="size-10 rounded-full"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                )}

                {/* Set value input */}
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Set value..."
                      value={setValueInputs[c.id] ?? ""}
                      onChange={(e) =>
                        setSetValueInputs((prev) => ({
                          ...prev,
                          [c.id]: e.target.value,
                        }))
                      }
                      className="text-center text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt(setValueInputs[c.id] ?? "");
                          if (!isNaN(val)) {
                            updateMutation.mutate({ id: c.id, value: val });
                            setSetValueInputs((prev) => ({
                              ...prev,
                              [c.id]: "",
                            }));
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const val = parseInt(setValueInputs[c.id] ?? "");
                        if (!isNaN(val)) {
                          updateMutation.mutate({ id: c.id, value: val });
                          setSetValueInputs((prev) => ({
                            ...prev,
                            [c.id]: "",
                          }));
                        }
                      }}
                      disabled={
                        updateMutation.isPending ||
                        isNaN(parseInt(setValueInputs[c.id] ?? ""))
                      }
                    >
                      Set
                    </Button>
                  </div>
                )}

                {/* Delete button */}
                {canManage && (
                  <div className="absolute right-3 top-3">
                    {deleteConfirmId === c.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() =>
                            deleteMutation.mutate({ id: c.id })
                          }
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? "..." : "Confirm"}
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
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => setDeleteConfirmId(c.id)}
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
