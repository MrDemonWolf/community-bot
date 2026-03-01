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
  Music,
  SkipForward,
  Trash2,
  Save,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
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

  const [settingsForm, setSettingsForm] = useState<{
    enabled: boolean;
    maxQueueSize: number;
    maxPerUser: number;
    minAccessLevel: string;
  } | null>(null);

  // Initialize form from fetched settings
  const currentSettings = settingsForm ?? (settings ? {
    enabled: settings.enabled,
    maxQueueSize: settings.maxQueueSize,
    maxPerUser: settings.maxPerUser,
    minAccessLevel: settings.minAccessLevel,
  } : null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
    queryClient.invalidateQueries({ queryKey: settingsQueryKey });
  }

  const updateSettingsMutation = useMutation(
    trpc.songRequest.updateSettings.mutationOptions({
      onSuccess: () => {
        toast.success("Settings saved.");
        setSettingsForm(null);
        invalidateAll();
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
    });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Song Requests</h1>
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
        <h1 className="mb-6 text-2xl font-bold text-foreground">Song Requests</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Song Requests</h1>

      <div className="space-y-6">
        {/* Settings Card */}
        {canManage && currentSettings && (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <h2 className="text-sm font-semibold text-foreground">Settings</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Enabled
                  </label>
                  <Button
                    variant={currentSettings.enabled ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setSettingsForm({
                        ...currentSettings,
                        enabled: !currentSettings.enabled,
                      })
                    }
                  >
                    {currentSettings.enabled ? "Enabled" : "Disabled"}
                  </Button>
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
                          {level.charAt(0) + level.slice(1).toLowerCase().replace(/_/g, " ")}
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
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <Music className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No song requests yet. Viewers can request songs with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">!sr &lt;song title&gt;</code>{" "}
              in chat.
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
                      <span className="line-clamp-1">{r.title}</span>
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
