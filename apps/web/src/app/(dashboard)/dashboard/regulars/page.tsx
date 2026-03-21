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
  DialogDescription,
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
  Users,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

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
        <PageHeader title="Regulars" platforms={["twitch", "discord"]} />
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
        <PageHeader title="Regulars" platforms={["twitch", "discord"]} />
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

  const totalCount = regulars?.length ?? 0;

  return (
    <div>
      <PageHeader title="Regulars" platforms={["twitch", "discord"]}>
        <span className="inline-flex items-center rounded-full bg-brand-main/10 px-2.5 py-0.5 text-xs font-medium text-brand-main">
          {totalCount}
        </span>
        <Button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          size="sm"
          variant="outline"
        >
          <RefreshCw
            className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        {canManage && (
          <Button
            onClick={() => setDialogOpen(true)}
            size="sm"
            className="bg-brand-main text-white hover:bg-brand-main/80"
          >
            <Plus className="size-3.5" />
            Add Regular
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username..."
            className="pl-9"
          />
        </div>

        {/* Regulars List */}
        {filteredRegulars.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No regulars match your search." : "No regulars added yet."}
            description={
              !search
                ? "Regulars are trusted users who get extra permissions in your chat."
                : undefined
            }
          >
            {!search && canManage && (
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="size-3.5" />
                Add your first regular
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Username
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Discord
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Added By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Date Added
                        </th>
                        {canManage && (
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRegulars.map((regular) => (
                        <tr
                          key={regular.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-twitch/10 text-sm font-medium text-brand-twitch">
                                {(regular.twitchUsername ?? "?")[0]?.toUpperCase()}
                              </div>
                              {regular.twitchUsername ? (
                                <span className="text-sm font-medium text-foreground">
                                  {regular.twitchUsername}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Unknown
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {regular.discordUsername ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-brand-discord">
                                <span className="size-1.5 rounded-full bg-brand-discord" />
                                {regular.discordUsername}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {regular.addedBy}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
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
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="grid gap-3 md:hidden">
              {filteredRegulars.map((regular) => (
                <Card key={regular.id} className="transition-colors hover:bg-muted/30">
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-twitch/10 text-sm font-bold text-brand-twitch">
                          {(regular.twitchUsername ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {regular.twitchUsername ?? "Unknown"}
                          </p>
                          {regular.discordUsername && (
                            <p className="flex items-center gap-1.5 text-xs text-brand-discord">
                              <span className="size-1.5 rounded-full bg-brand-discord" />
                              {regular.discordUsername}
                            </p>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1">
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
                            <div className="flex items-center gap-1">
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
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>by {regular.addedBy}</span>
                      <span>{new Date(regular.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {totalCount} regular{totalCount !== 1 ? "s" : ""} total
          {search && filteredRegulars
            ? ` (${filteredRegulars.length} matching)`
            : ""}
        </p>
      </div>

      {/* Add Regular Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup>
          <DialogCloseButton />
          <DialogTitle>Add Regular</DialogTitle>
          <DialogDescription>
            Add a trusted user who gets extra permissions in your chat.
          </DialogDescription>
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
                placeholder="e.g. username"
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
                className="bg-brand-main text-white hover:bg-brand-main/80"
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
          <DialogDescription>
            Connect a Discord account to this regular for cross-platform permissions.
          </DialogDescription>
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
                placeholder="e.g. username"
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
                className="bg-brand-main text-white hover:bg-brand-main/80"
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
