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
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  ListMusic,
  Plus,
  Play,
  Trash2,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaylistsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.playlist.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: playlistData, isLoading } = useQuery(
    trpc.playlist.list.queryOptions()
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: selectedPlaylist, isLoading: loadingPlaylist } = useQuery({
    ...trpc.playlist.get.queryOptions({ id: selectedId! }),
    enabled: !!selectedId,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
    if (selectedId) {
      queryClient.invalidateQueries({
        queryKey: trpc.playlist.get.queryOptions({ id: selectedId }).queryKey,
      });
    }
  }

  const createMutation = useMutation(
    trpc.playlist.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Playlist "${data.name}" created.`);
        setCreateDialogOpen(false);
        setNewPlaylistName("");
        setSelectedId(data.id);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.playlist.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Playlist deleted.");
        if (deleteConfirmId === selectedId) setSelectedId(null);
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const setActiveMutation = useMutation(
    trpc.playlist.setActive.mutationOptions({
      onSuccess: () => {
        toast.success("Active playlist updated.");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const addEntryMutation = useMutation(
    trpc.playlist.addEntry.mutationOptions({
      onSuccess: () => {
        toast.success("Song added to playlist.");
        setAddEntryDialogOpen(false);
        setNewEntryTitle("");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeEntryMutation = useMutation(
    trpc.playlist.removeEntry.mutationOptions({
      onSuccess: () => {
        toast.success("Entry removed.");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const reorderMutation = useMutation(
    trpc.playlist.reorderEntries.mutationOptions({
      onSuccess: () => invalidateAll(),
      onError: (err) => toast.error(err.message),
    })
  );

  function handleMoveUp(index: number) {
    if (!selectedPlaylist || index <= 0) return;
    const ids = selectedPlaylist.entries.map((e) => e.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderMutation.mutate({
      playlistId: selectedPlaylist.id,
      entryIds: ids,
    });
  }

  function handleMoveDown(index: number) {
    if (!selectedPlaylist || index >= selectedPlaylist.entries.length - 1) return;
    const ids = selectedPlaylist.entries.map((e) => e.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderMutation.mutate({
      playlistId: selectedPlaylist.id,
      entryIds: ids,
    });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Playlists</h1>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage playlists.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Playlists</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const playlists = playlistData?.playlists ?? [];
  const activePlaylistId = playlistData?.activePlaylistId ?? null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Playlists</h1>
        {canManage && (
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="size-3.5" />
            Create Playlist
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left Panel: Playlist List */}
        <div className="space-y-2">
          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
              <ListMusic className="mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No playlists yet.
              </p>
            </div>
          ) : (
            playlists.map((playlist) => (
              <Card
                key={playlist.id}
                className={`cursor-pointer transition-colors hover:bg-surface-raised ${
                  selectedId === playlist.id ? "border-brand-main bg-brand-main/5" : ""
                }`}
                onClick={() => setSelectedId(playlist.id)}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {playlist.name}
                      </span>
                      {activePlaylistId === playlist.id && (
                        <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-500">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {playlist.entryCount} song{playlist.entryCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMutation.mutate({
                            playlistId:
                              activePlaylistId === playlist.id
                                ? null
                                : playlist.id,
                          });
                        }}
                        aria-label={
                          activePlaylistId === playlist.id
                            ? "Deactivate playlist"
                            : "Set as active"
                        }
                      >
                        {activePlaylistId === playlist.id ? (
                          <Check className="size-3.5 text-green-500" />
                        ) : (
                          <Play className="size-3.5 text-muted-foreground" />
                        )}
                      </Button>
                      {deleteConfirmId === playlist.id ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() =>
                              deleteMutation.mutate({ id: playlist.id })
                            }
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? "..." : "Delete"}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(playlist.id);
                          }}
                          aria-label={`Delete ${playlist.name}`}
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right Panel: Selected Playlist Entries */}
        <div>
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
              <p className="text-sm text-muted-foreground">
                Select a playlist to view its songs.
              </p>
            </div>
          ) : loadingPlaylist ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedPlaylist?.name}
                </h2>
                {canManage && (
                  <Button
                    onClick={() => setAddEntryDialogOpen(true)}
                    size="sm"
                  >
                    <Plus className="size-3.5" />
                    Add Song
                  </Button>
                )}
              </div>

              {(selectedPlaylist?.entries.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
                  <p className="text-sm text-muted-foreground">
                    No songs in this playlist yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          #
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Title
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Duration
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Channel
                        </th>
                        {canManage && (
                          <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedPlaylist?.entries.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className="transition-colors hover:bg-surface-raised"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {entry.position}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-sm text-foreground">
                            <div className="flex items-center gap-2">
                              {entry.youtubeThumbnail && (
                                <img
                                  src={entry.youtubeThumbnail}
                                  alt=""
                                  className="h-8 w-14 shrink-0 rounded object-cover"
                                />
                              )}
                              <span className="line-clamp-1">{entry.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {entry.youtubeDuration
                              ? formatDuration(entry.youtubeDuration)
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {entry.youtubeChannel ?? "—"}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled={index === 0 || reorderMutation.isPending}
                                  onClick={() => handleMoveUp(index)}
                                  aria-label="Move up"
                                >
                                  <ArrowUp className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled={
                                    index ===
                                      (selectedPlaylist?.entries.length ?? 1) - 1 ||
                                    reorderMutation.isPending
                                  }
                                  onClick={() => handleMoveDown(index)}
                                  aria-label="Move down"
                                >
                                  <ArrowDown className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() =>
                                    removeEntryMutation.mutate({ id: entry.id })
                                  }
                                  disabled={removeEntryMutation.isPending}
                                  aria-label={`Remove ${entry.title}`}
                                >
                                  <Trash2 className="size-3.5 text-red-400" />
                                </Button>
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
          )}
        </div>
      </div>

      {/* Create Playlist Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogPopup>
          <DialogCloseButton />
          <DialogTitle>Create Playlist</DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPlaylistName.trim()) {
                createMutation.mutate({ name: newPlaylistName.trim() });
              }
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Playlist Name
              </label>
              <Input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="e.g. Chill Vibes"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setNewPlaylistName("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newPlaylistName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Create
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={addEntryDialogOpen} onOpenChange={setAddEntryDialogOpen}>
        <DialogPopup>
          <DialogCloseButton />
          <DialogTitle>Add Song</DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newEntryTitle.trim() && selectedId) {
                addEntryMutation.mutate({
                  playlistId: selectedId,
                  title: newEntryTitle.trim(),
                });
              }
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Song Title or YouTube URL
              </label>
              <Input
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                placeholder="Enter song title or paste YouTube URL..."
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                YouTube metadata will be fetched automatically if a YouTube API key is configured.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddEntryDialogOpen(false);
                  setNewEntryTitle("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newEntryTitle.trim() || addEntryMutation.isPending}
              >
                {addEntryMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add Song
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
