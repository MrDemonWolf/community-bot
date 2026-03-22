"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { withToast } from "@/hooks/use-toast-mutation";
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
import { ACCESS_LEVELS } from "@/lib/format";

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
  const [clearConfirm, setClearConfirm] = useState(false);
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
    withToast(trpc.songRequest.updateSettings.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: listQueryKey }),
          queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
        ]);
        setSettingsForm(null);
      },
    }), "Settings saved.")
  );

  const skipMutation = useMutation(
    withToast(trpc.songRequest.skip.mutationOptions({
      onSuccess: () => {
        invalidateAll();
      },
    }), "Song skipped.")
  );

  const removeMutation = useMutation(
    withToast(trpc.songRequest.remove.mutationOptions({
      onSuccess: () => {
        invalidateAll();
      },
    }), "Song removed.")
  );

  const clearMutation = useMutation(
    withToast(trpc.songRequest.clear.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setClearConfirm(false);
      },
    }), "Queue cleared.")
  );

  function handleSaveSettings() {
    if (!currentSettings) return;
    updateSettingsMutation.mutate({
      enabled: currentSettings.enabled,
      maxQueueSize: currentSettings.maxQueueSize,
      maxPerUser: currentSettings.maxPerUser,
      minAccessLevel: currentSettings.minAccessLevel as typeof ACCESS_LEVELS[number],
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

  const requestCount = requests?.length ?? 0;

  return (
    <div>
      <PageHeader title="Song Requests" platforms={["twitch"]}>
        <Badge className={currentSettings?.enabled
          ? "border-transparent bg-green-500/15 text-green-700 dark:text-green-400"
          : "border-transparent bg-muted text-muted-foreground"
        }>
          {currentSettings?.enabled ? "Enabled" : "Disabled"}
        </Badge>
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
        {/* Disabled Banner */}
        {!currentSettings?.enabled && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Song requests are disabled
                </p>
                <p className="text-sm text-muted-foreground">
                  Enable song requests to allow viewers to request songs via the !sr command.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Now Playing / Queue / Actions — muted when disabled */}
        <div className={!currentSettings?.enabled ? "opacity-50 pointer-events-none" : ""}>
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
                    <div className="absolute inset-0 hidden bg-gradient-to-r from-transparent to-card/50 sm:block" />
                  </div>
                )}
                {/* Song Info */}
                <div className="flex flex-1 items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-full bg-brand-main/10">
                        <Play className="size-3 text-brand-main" />
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wider text-brand-main">Now Playing</span>
                      {currentSong.source === "playlist" && (
                        <Badge className="border-transparent bg-brand-main/10 text-brand-main">
                          Playlist
                        </Badge>
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
        </div>

        {/* Settings Card */}
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

        {/* Queue / Actions — muted when disabled */}
        <div className={`space-y-6${!currentSettings?.enabled ? " opacity-50 pointer-events-none" : ""}`}>
        {/* Queue Actions */}
        {canManage && requestCount > 0 && (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <p className="mr-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => skipMutation.mutate()}
                disabled={skipMutation.isPending}
              >
                <SkipForward className="size-3.5" />
                Skip Current
              </Button>
              {clearConfirm ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => clearMutation.mutate()}
                    disabled={clearMutation.isPending}
                  >
                    {clearMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Confirm Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setClearConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setClearConfirm(true)}
                >
                  <Trash2 className="size-3.5" />
                  Clear Queue
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Queue Table */}
        {requestCount === 0 ? (
          <EmptyState
            icon={Music}
            title="No song requests yet"
            description="Viewers can request songs with !sr <song title> in chat."
          />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Source
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Requested By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Time
                      </th>
                      {canManage && (
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                        <td className="px-4 py-3">
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-main/10 text-xs font-bold text-brand-main">
                            {r.position}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            {r.youtubeThumbnail && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.youtubeThumbnail}
                                alt=""
                                className="h-8 w-14 shrink-0 rounded object-cover"
                              />
                            )}
                            <span className="line-clamp-1 font-medium">{r.title}</span>
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
                            : "\u2014"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={
                            r.source === "playlist"
                              ? "border-transparent bg-brand-main/10 text-brand-main"
                              : "border-transparent bg-muted text-muted-foreground"
                          }>
                            {r.source === "playlist" ? "Playlist" : "Viewer"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {r.requestedBy}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => skipMutation.mutate()}
                                disabled={skipMutation.isPending}
                                aria-label={`Skip to ${r.title}`}
                              >
                                <SkipForward className="size-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => removeMutation.mutate({ id: r.id })}
                                disabled={removeMutation.isPending}
                                aria-label={`Remove ${r.title}`}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="divide-y divide-border md:hidden">
                {requests?.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-main/10 text-sm font-bold text-brand-main">
                        {r.position}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {r.title}
                          </p>
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
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{r.requestedBy}</span>
                          {r.youtubeDuration && (
                            <>
                              <span>&middot;</span>
                              <span>{formatDuration(r.youtubeDuration)}</span>
                            </>
                          )}
                          <Badge className={
                            r.source === "playlist"
                              ? "border-transparent bg-brand-main/10 text-brand-main"
                              : "border-transparent bg-muted text-muted-foreground"
                          }>
                            {r.source === "playlist" ? "Playlist" : "Viewer"}
                          </Badge>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeMutation.mutate({ id: r.id })}
                            disabled={removeMutation.isPending}
                            aria-label={`Remove ${r.title}`}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          {requestCount > 0
            ? `${requestCount} ${requestCount === 1 ? "song" : "songs"} in queue. `
            : ""}
          Song requests are managed via chat commands (!sr) or this dashboard.
        </p>
        </div>
      </div>
    </div>
  );
}
