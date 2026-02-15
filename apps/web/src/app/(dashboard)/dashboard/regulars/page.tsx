"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

export default function RegularsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.regular.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: regulars, isLoading } = useQuery(
    trpc.regular.list.queryOptions()
  );

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const addMutation = useMutation(
    trpc.regular.add.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Added ${data.twitchUsername} as a regular.`);
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        setDialogOpen(false);
        setNewUsername("");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeMutation = useMutation(
    trpc.regular.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Regular removed.");
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        setDeleteConfirmId(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const refreshMutation = useMutation(
    trpc.regular.refreshUsernames.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Refreshed ${data.updated} of ${data.total} usernames.`
        );
        queryClient.invalidateQueries({ queryKey: listQueryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Regulars</h1>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage regulars.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Regulars</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const filteredRegulars = (regulars ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.twitchUsername.toLowerCase().includes(q) ||
      r.twitchUserId.includes(q)
    );
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Regulars</h1>

      <div className="space-y-4">
        {/* Search + Actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search regulars..."
              className="pl-8"
            />
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            size="sm"
            variant="outline"
          >
            <RefreshCw
              className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
            Refresh Names
          </Button>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="size-3.5" />
            Add Regular
          </Button>
        </div>

        {/* Regulars Table */}
        {filteredRegulars.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <p className="text-sm text-muted-foreground">
              {search
                ? "No regulars match your search."
                : "No regulars added yet."}
            </p>
            {!search && (
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                <Plus className="size-3.5" />
                Add your first regular
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Username
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Twitch User ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Added By
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date Added
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRegulars.map((regular) => (
                  <tr
                    key={regular.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-brand-main">
                      {regular.twitchUsername}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {regular.twitchUserId}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {regular.addedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(regular.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deleteConfirmId === regular.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() =>
                              removeMutation.mutate({ id: regular.id })
                            }
                            disabled={removeMutation.isPending}
                          >
                            {removeMutation.isPending ? "..." : "Confirm"}
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
                          onClick={() => setDeleteConfirmId(regular.id)}
                          aria-label={`Remove ${regular.twitchUsername}`}
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Regular Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup>
          <DialogCloseButton />
          <DialogTitle>Add Regular</DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newUsername.trim()) {
                addMutation.mutate({ username: newUsername.trim() });
              }
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Twitch Username
              </label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter Twitch username..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setNewUsername("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newUsername.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add Regular
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
