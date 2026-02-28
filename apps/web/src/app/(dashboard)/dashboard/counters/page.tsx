"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Minus,
  Hash,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";

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
        <h1 className="mb-6 text-2xl font-bold text-foreground">Counters</h1>
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
        <h1 className="mb-6 text-2xl font-bold text-foreground">Counters</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Counters</h1>

      <div className="space-y-4">
        {/* Create new counter */}
        {canManage && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Counter name..."
              value={newCounterName}
              onChange={(e) => setNewCounterName(e.target.value)}
              className="w-64"
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
              Create
            </Button>
          </div>
        )}

        {/* Counters list */}
        {(counters?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <Hash className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No counters yet. Create one above!
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {counters?.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {c.name}
                    </p>
                    <p className="text-2xl font-bold text-brand-main">
                      {c.value}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() =>
                          updateMutation.mutate({
                            id: c.id,
                            value: c.value - 1,
                          })
                        }
                        disabled={updateMutation.isPending}
                        aria-label={`Decrement ${c.name}`}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() =>
                          updateMutation.mutate({
                            id: c.id,
                            value: c.value + 1,
                          })
                        }
                        disabled={updateMutation.isPending}
                        aria-label={`Increment ${c.name}`}
                      >
                        <Plus className="size-3" />
                      </Button>
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
                          onClick={() => setDeleteConfirmId(c.id)}
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Use <code className="rounded bg-surface-raised px-1">{"{counter <name>"}</code> in custom commands to display a counter value.
        </p>
      </div>
    </div>
  );
}
