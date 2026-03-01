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
  Link2,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";

export default function RegularsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.regular.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");
  const { data: regulars, isLoading } = useQuery(
    trpc.regular.list.queryOptions()
  );

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDiscordUserId, setNewDiscordUserId] = useState("");
  const [newDiscordUsername, setNewDiscordUsername] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [linkDiscordId, setLinkDiscordId] = useState<string | null>(null);
  const [linkDiscordValue, setLinkDiscordValue] = useState("");
  const [linkDiscordName, setLinkDiscordName] = useState("");

  const addMutation = useMutation(
    trpc.regular.add.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Added ${data.twitchUsername} as a regular.`);
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        setDialogOpen(false);
        setNewUsername("");
        setNewDiscordUserId("");
        setNewDiscordUsername("");
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

  const linkDiscordMutation = useMutation(
    trpc.regular.linkDiscord.mutationOptions({
      onSuccess: () => {
        toast.success("Discord account linked.");
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        setLinkDiscordId(null);
        setLinkDiscordValue("");
        setLinkDiscordName("");
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
      (r.twitchUsername?.toLowerCase().includes(q) ?? false) ||
      (r.twitchUserId?.includes(q) ?? false) ||
      (r.discordUserId?.includes(q) ?? false) ||
      (r.discordUsername?.toLowerCase().includes(q) ?? false)
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
          {canManage && (
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="size-3.5" />
              Add Regular
            </Button>
          )}
        </div>

        {/* Regulars Table */}
        {filteredRegulars.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <p className="text-sm text-muted-foreground">
              {search
                ? "No regulars match your search."
                : "No regulars added yet."}
            </p>
            {!search && canManage && (
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
                    Twitch
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Discord
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Added By
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date Added
                  </th>
                  {canManage && (
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRegulars.map((regular) => (
                  <tr
                    key={regular.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3">
                      {regular.twitchUsername ? (
                        <div>
                          <span className="text-sm font-medium text-brand-main">
                            {regular.twitchUsername}
                          </span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {regular.twitchUserId}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {regular.discordUsername ? (
                        <div>
                          <span className="text-sm font-medium text-brand-discord">
                            {regular.discordUsername}
                          </span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {regular.discordUserId}
                          </span>
                        </div>
                      ) : regular.discordUserId ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {regular.discordUserId}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {regular.addedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(regular.createdAt).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!regular.discordUserId && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                setLinkDiscordId(regular.id);
                                setLinkDiscordValue("");
                                setLinkDiscordName("");
                              }}
                              aria-label={`Link Discord for ${regular.twitchUsername}`}
                            >
                              <Link2 className="size-3.5 text-brand-discord" />
                            </Button>
                          )}
                          {deleteConfirmId === regular.id ? (
                            <>
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
                            </>
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
                        </div>
                      </td>
                    )}
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
                addMutation.mutate({
                  username: newUsername.trim(),
                  ...(newDiscordUserId.trim()
                    ? { discordUserId: newDiscordUserId.trim() }
                    : {}),
                  ...(newDiscordUsername.trim()
                    ? { discordUsername: newDiscordUsername.trim() }
                    : {}),
                });
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Discord User ID{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={newDiscordUserId}
                onChange={(e) => setNewDiscordUserId(e.target.value)}
                placeholder="e.g. 123456789012345678"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Discord Username{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={newDiscordUsername}
                onChange={(e) => setNewDiscordUsername(e.target.value)}
                placeholder="e.g. user#1234"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setNewUsername("");
                  setNewDiscordUserId("");
                  setNewDiscordUsername("");
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

      {/* Link Discord Dialog */}
      <Dialog
        open={!!linkDiscordId}
        onOpenChange={(open) => {
          if (!open) setLinkDiscordId(null);
        }}
      >
        <DialogPopup>
          <DialogCloseButton />
          <DialogTitle>Link Discord Account</DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (linkDiscordId && linkDiscordValue.trim()) {
                linkDiscordMutation.mutate({
                  id: linkDiscordId,
                  discordUserId: linkDiscordValue.trim(),
                  ...(linkDiscordName.trim()
                    ? { discordUsername: linkDiscordName.trim() }
                    : {}),
                });
              }
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Discord User ID
              </label>
              <Input
                value={linkDiscordValue}
                onChange={(e) => setLinkDiscordValue(e.target.value)}
                placeholder="e.g. 123456789012345678"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Discord Username{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={linkDiscordName}
                onChange={(e) => setLinkDiscordName(e.target.value)}
                placeholder="e.g. user#1234"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLinkDiscordId(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !linkDiscordValue.trim() || linkDiscordMutation.isPending
                }
              >
                {linkDiscordMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Link2 className="size-3.5" />
                )}
                Link Discord
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
