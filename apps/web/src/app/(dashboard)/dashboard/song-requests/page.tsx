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
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Loader2,
  Music,
  Play,
  Settings,
  SkipForward,
  Trash2,
  Save,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCESS_LEVELS = [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
] as const;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SongRequestsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.songRequest.list.queryOptions().queryKey;
  const settingsQueryKey = trpc.songRequest.getSettings.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: requests, isLoading: loadingRequests } = useQuery(
    trpc.songRequest.list.queryOptions()
  );
  const { data: settings, isLoading: loadingSettings } = useQuery(
    trpc.songRequest.getSettings.queryOptions()
  );
  const { data: playlistData } = useQuery(
    trpc.playlist.list.queryOptions()
  );
  const { data: currentSong } = useQuery({
    ...trpc.songRequest.current.queryOptions(),
    refetchInterval: 10000,
  });

  const [showPlayer, setShowPlayer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{
    enabled: boolean;
    maxQueueSize: number;
    maxPerUser: number;
    minAccessLevel: string;
    maxDuration: number | null;
    autoPlayEnabled: boolean;
    activePlaylistId: string | null;
  } | null>(null);

  // Initialize form from fetched settings
  const currentSettings = settingsForm ?? (settings ? {
    enabled: settings.enabled,
    maxQueueSize: settings.maxQueueSize,
    maxPerUser: settings.maxPerUser,
    minAccessLevel: settings.minAccessLevel,
    maxDuration: settings.maxDuration ?? null,
    autoPlayEnabled: settings.autoPlayEnabled ?? false,
    activePlaylistId: settings.activePlaylistId ?? null,
  } : null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
    queryClient.invalidateQueries({ queryKey: settingsQueryKey });
  }

  const updateSettingsMutation = useMutation(
    trpc.songRequest.updateSettings.mutationOptions({
      onSuccess: async () => {
        toast.success("Settings saved.");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: listQueryKey }),
          queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
        ]);
        setSettingsForm(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const skipMutation = useMutation(
    trpc.songRequest.skip.mutationOptions({
      onSuccess: () => {
        toast.success("Song skipped.");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeMutation = useMutation(
    trpc.songRequest.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Song removed.");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const clearMutation = useMutation(
    trpc.songRequest.clear.mutationOptions({
      onSuccess: () => {
        toast.success("Queue cleared.");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSaveSettings() {
    if (!currentSettings) return;
    updateSettingsMutation.mutate({
      enabled: currentSettings.enabled,
      maxQueueSize: currentSettings.maxQueueSize,
      maxPerUser: currentSettings.maxPerUser,
      minAccessLevel: currentSettings.minAccessLevel as any,
      maxDuration: currentSettings.maxDuration,
      autoPlayEnabled: currentSettings.autoPlayEnabled,
      activePlaylistId: currentSettings.activePlaylistId,
    });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Song Requests" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage song requests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingRequests || loadingSettings) {
    return (
      <div>
        <PageHeader title="Song Requests" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Song Requests" platforms={["twitch"]}>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${window.location.origin}/overlay/song-requests`;
              navigator.clipboard.writeText(url);
              toast.success("Overlay URL copied! Add it as a Browser Source in OBS.");
            }}
          >
            <Copy className="size-3.5" />
            Copy Overlay URL
          </Button>
        )}
      </PageHeader>

      <div className="space-y-6">
        {/* Now Playing Hero Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {currentSong ? (
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                {currentSong.youtubeThumbnail && (
                  <div className="relative shrink-0 sm:w-[200px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentSong.youtubeThumbnail}
                      alt=""
                      className="h-full w-full object-cover sm:aspect-video"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/50 hidden sm:block" />
                  </div>
                )}
                {/* Song Info */}
                <div className="flex flex-1 items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-main/10">
                        <Play className="size-3 text-brand-main" />
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wider text-brand-main">Now Playing</span>
                      {currentSong.source === "playlist" && (
                        <span className="rounded-full bg-brand-main/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-main">
                          Playlist
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {currentSong.title}
                      </h2>
                      {currentSong.youtubeVideoId && (
                        <a
                          href={`https://youtu.be/${currentSong.youtubeVideoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                    {currentSong.youtubeChannel && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{currentSong.youtubeChannel}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Requested by {currentSong.requestedBy}</span>
                      {currentSong.youtubeDuration && (
                        <>
                          <span>&middot;</span>
                          <span>{formatDuration(currentSong.youtubeDuration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => skipMutation.mutate()}
                        disabled={skipMutation.isPending}
                      >
                        <SkipForward className="size-3.5" />
                        Skip
                      </Button>
                    )}
                    {currentSong.youtubeVideoId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPlayer(!showPlayer)}
                      >
                        {showPlayer ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        {showPlayer ? "Hide Player" : "Show Player"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-6 text-muted-foreground">
                <Music className="size-5" />
                <span className="text-sm">No song currently playing.</span>
              </div>
            )}
          </CardContent>
          {showPlayer && currentSong?.youtubeVideoId && (
            <div className="border-t border-border">
              <iframe
                src={`https://www.youtube.com/embed/${currentSong.youtubeVideoId}?autoplay=0`}
                title={currentSong.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </Card>

        {/* Collapsible Settings Card */}
        {canManage && currentSettings && (
          <Card>
            <CardContent className="p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Settings</h2>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    currentSettings.enabled
                      ? "bg-green-500/10 text-green-500"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {currentSettings.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                {settingsOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {settingsOpen && (
                <div className="space-y-4 border-t border-border px-4 pb-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Enabled
                      </label>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          checked={currentSettings.enabled}
                          onCheckedChange={(v) =>
                            setSettingsForm({
                              ...currentSettings,
                              enabled: v,
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {currentSettings.enabled ? "On" : "Off"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Max Queue Size
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={currentSettings.maxQueueSize}
                        onChange={(e) =>
                          setSettingsForm({
                            ...currentSettings,
                            maxQueueSize: parseInt(e.target.value) || 50,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Max Per User
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={currentSettings.maxPerUser}
                        onChange={(e) =>
                          setSettingsForm({
                            ...currentSettings,
                            maxPerUser: parseInt(e.target.value) || 5,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Min Access Level
                      </label>
                      <Select value={currentSettings.minAccessLevel} onValueChange={(v) => { if (v) setSettingsForm({ ...currentSettings, minAccessLevel: v }); }}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCESS_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level.split("_").map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* YouTube & Playlist Settings */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Max Duration (seconds)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={36000}
                        value={currentSettings.maxDuration ?? ""}
                        placeholder="No limit"
                        onChange={(e) =>
                          setSettingsForm({
                            ...currentSettings,
                            maxDuration: e.target.value ? parseInt(e.target.value) || null : null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Auto-Play from Playlist
                      </label>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          checked={currentSettings.autoPlayEnabled}
                          onCheckedChange={(v) =>
                            setSettingsForm({
                              ...currentSettings,
                              autoPlayEnabled: v,
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {currentSettings.autoPlayEnabled ? "On" : "Off"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Active Playlist
                      </label>
                      <Select
                        value={currentSettings.activePlaylistId ?? "none"}
                        onValueChange={(v) =>
                          setSettingsForm({
                            ...currentSettings,
                            activePlaylistId: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {playlistData?.playlists?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.entryCount} songs)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {settingsForm && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveSettings}
                        disabled={updateSettingsMutation.isPending}
                      >
                        <Save className="size-3.5" />
                        Save Settings
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSettingsForm(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Queue Actions */}
        {canManage && (requests?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => skipMutation.mutate()}
              disabled={skipMutation.isPending}
            >
              <SkipForward className="size-3.5" />
              Skip Current
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="size-3.5" />
              Clear All
            </Button>
          </div>
        )}

        {/* Queue Table */}
        {(requests?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Music}
            title="No song requests yet"
            description="Viewers can request songs with !sr <song title> in chat."
          />
        ) : (
          <div className="glass overflow-x-auto rounded-lg border border-border bg-card">
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
                    Source
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Requested By
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Time
                  </th>
                  {canManage && (
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests?.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {r.position}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        {r.youtubeThumbnail && (
                          <img
                            src={r.youtubeThumbnail}
                            alt=""
                            className="h-8 w-14 shrink-0 rounded object-cover"
                          />
                        )}
                        <span className="line-clamp-1">{r.title}</span>
                        {r.youtubeVideoId && (
                          <a
                            href={`https://youtu.be/${r.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {r.youtubeDuration
                        ? formatDuration(r.youtubeDuration)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.source === "playlist"
                            ? "bg-brand-main/10 text-brand-main"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.source === "playlist" ? "Playlist" : "Viewer"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {r.requestedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeMutation.mutate({ id: r.id })}
                          disabled={removeMutation.isPending}
                          aria-label={`Remove ${r.title}`}
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Song requests are managed via chat commands (!sr) or this dashboard. Enable song requests in settings above.
        </p>
      </div>
    </div>
  );
}
