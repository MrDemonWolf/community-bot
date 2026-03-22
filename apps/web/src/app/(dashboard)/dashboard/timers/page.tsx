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
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { withToast } from "@/hooks/use-toast-mutation";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Timer,
  Info,
  Clock,
  MessageSquare,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

interface TimerFormState {
  name: string;
  message: string;
  intervalMinutes: number;
  chatLines: number;
  onlineIntervalSeconds: number;
  offlineIntervalSeconds: number | null;
  enabledWhenOnline: boolean;
  enabledWhenOffline: boolean;
  gameFilter: string[];
  titleKeywords: string[];
}

const emptyForm: TimerFormState = {
  name: "",
  message: "",
  intervalMinutes: 5,
  chatLines: 0,
  onlineIntervalSeconds: 300,
  offlineIntervalSeconds: null,
  enabledWhenOnline: true,
  enabledWhenOffline: false,
  gameFilter: [],
  titleKeywords: [],
};

export default function TimersPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.timer.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: timers, isLoading } = useQuery(
    trpc.timer.list.queryOptions()
  );

  const [form, setForm] = useState<TimerFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const createMutation = useMutation(
    withToast(trpc.timer.create.mutationOptions({
      onSuccess: () => {
        setForm(emptyForm);
        setShowForm(false);
        invalidateAll();
      },
    }), "Timer created.")
  );

  const updateMutation = useMutation(
    withToast(trpc.timer.update.mutationOptions({
      onSuccess: () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
        invalidateAll();
      },
    }), "Timer updated.")
  );

  const deleteMutation = useMutation(
    withToast(trpc.timer.delete.mutationOptions({
      onSuccess: () => {
        setDeleteConfirmId(null);
        invalidateAll();
      },
    }), "Timer deleted.")
  );

  const toggleMutation = useMutation(
    withToast(trpc.timer.toggleEnabled.mutationOptions({
      onSuccess: () => {
        invalidateAll();
      },
    }), "Timer toggled.")
  );

  function handleSubmit() {
    if (!form.name.trim() || !form.message.trim()) return;
    const payload = {
      name: form.name.trim(),
      message: form.message.trim(),
      intervalMinutes: form.intervalMinutes,
      chatLines: form.chatLines,
      onlineIntervalSeconds: form.onlineIntervalSeconds,
      offlineIntervalSeconds: form.offlineIntervalSeconds,
      enabledWhenOnline: form.enabledWhenOnline,
      enabledWhenOffline: form.enabledWhenOffline,
      gameFilter: form.gameFilter,
      titleKeywords: form.titleKeywords,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function startEdit(timer: NonNullable<typeof timers>[number]) {
    setForm({
      name: timer.name,
      message: timer.message,
      intervalMinutes: timer.intervalMinutes,
      chatLines: timer.chatLines,
      onlineIntervalSeconds: timer.onlineIntervalSeconds,
      offlineIntervalSeconds: timer.offlineIntervalSeconds ?? null,
      enabledWhenOnline: timer.enabledWhenOnline,
      enabledWhenOffline: timer.enabledWhenOffline,
      gameFilter: timer.gameFilter ?? [],
      titleKeywords: timer.titleKeywords ?? [],
    });
    setEditingId(timer.id);
    setShowForm(true);
  }

  function addTag(field: "gameFilter" | "titleKeywords", value: string) {
    if (!value.trim()) return;
    setForm({ ...form, [field]: [...form[field], value.trim()] });
  }

  function removeTag(field: "gameFilter" | "titleKeywords", idx: number) {
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Timers" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage timers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Timers" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Timers" platforms={["twitch"]}>
        {canManage && !showForm && (
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5" />
            Create Timer
          </Button>
        )}
      </PageHeader>

      {/* Hint text */}
      <div className="glass-subtle mb-6 flex items-center gap-2 rounded-lg px-3 py-2">
        <Info className="size-4 shrink-0 text-brand-main" />
        <p className="text-xs text-muted-foreground">
          Timers post recurring messages to chat. Chat lines threshold requires
          a minimum number of chat messages between posts.
        </p>
      </div>

      <div className="space-y-4">
        {/* Create/Edit Form */}
        {showForm && canManage && (
          <Card className="glass border-brand-main/20">
            <CardHeader>
              <CardTitle className="font-heading text-base">
                {editingId ? "Edit Timer" : "New Timer"}
              </CardTitle>
              <CardDescription>
                {editingId
                  ? "Update the timer configuration below."
                  : "Configure a new recurring chat message."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Name
                  </label>
                  <Input
                    placeholder="Timer name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Interval (min)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      value={form.intervalMinutes}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          intervalMinutes: parseInt(e.target.value) || 5,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Min chat lines
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      value={form.chatLines}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          chatLines: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Message
                </label>
                <Input
                  placeholder="Timer message (supports variables like {uptime}, {game}, etc.)"
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Online Interval (seconds)
                  </label>
                  <Input
                    type="number"
                    min={30}
                    max={86400}
                    value={form.onlineIntervalSeconds}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        onlineIntervalSeconds:
                          parseInt(e.target.value) || 300,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Offline Interval (seconds, optional)
                  </label>
                  <Input
                    type="number"
                    min={30}
                    max={86400}
                    placeholder="Same as online"
                    value={form.offlineIntervalSeconds ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        offlineIntervalSeconds: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={form.enabledWhenOnline}
                    onCheckedChange={(v) =>
                      setForm({ ...form, enabledWhenOnline: v })
                    }
                  />
                  Fire when online
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={form.enabledWhenOffline}
                    onCheckedChange={(v) =>
                      setForm({ ...form, enabledWhenOffline: v })
                    }
                  />
                  Fire when offline
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Game Filter (fire only for these games)
                </label>
                <div className="mb-1 flex flex-wrap gap-1">
                  {form.gameFilter.map((g, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded-full bg-brand-main/10 px-2 py-0.5 text-xs text-brand-main"
                    >
                      {g}
                      <button
                        type="button"
                        onClick={() => removeTag("gameFilter", i)}
                        className="ml-0.5 text-brand-main/60 hover:text-brand-main"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  placeholder="Add game name, press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addTag(
                        "gameFilter",
                        (e.target as HTMLInputElement).value
                      );
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title Keywords (fire only when title contains)
                </label>
                <div className="mb-1 flex flex-wrap gap-1">
                  {form.titleKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded-full bg-brand-main/10 px-2 py-0.5 text-xs text-brand-main"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeTag("titleKeywords", i)}
                        className="ml-0.5 text-brand-main/60 hover:text-brand-main"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  placeholder="Add title keyword, press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addTag(
                        "titleKeywords",
                        (e.target as HTMLInputElement).value
                      );
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={
                    !form.name.trim() ||
                    !form.message.trim() ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {editingId ? "Save Changes" : "Create Timer"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timer Cards */}
        {(timers?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Timer}
            title="No timers yet"
            description="Timers post recurring messages to chat at set intervals."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {timers?.map((t) => (
              <Card
                key={t.id}
                className={`glass group relative overflow-hidden transition-all ${
                  t.enabled
                    ? "border-l-4 border-l-brand-main"
                    : "border-l-4 border-l-transparent opacity-75"
                }`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Timer info */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-sm font-semibold text-foreground">
                          {t.name}
                        </h3>
                        {t.enabled ? (
                          <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-500">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Disabled
                          </span>
                        )}
                      </div>

                      {/* Message preview */}
                      <div className="flex items-start gap-2">
                        <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {t.message}
                        </p>
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          Every {t.intervalMinutes}m
                        </span>
                        {t.chatLines > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3" />
                            {t.chatLines} chat lines
                          </span>
                        )}
                        {t.enabledWhenOnline && (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                            Online
                          </span>
                        )}
                        {t.enabledWhenOffline && (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                            Offline
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={() => {
                          if (canManage)
                            toggleMutation.mutate({ id: t.id });
                        }}
                        disabled={!canManage || toggleMutation.isPending}
                        aria-label={
                          t.enabled ? "Disable timer" : "Enable timer"
                        }
                      />

                      {canManage && (
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => startEdit(t)}
                            aria-label={`Edit ${t.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {deleteConfirmId === t.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() =>
                                  deleteMutation.mutate({ id: t.id })
                                }
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending
                                  ? "..."
                                  : "Confirm"}
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
                              onClick={() => setDeleteConfirmId(t.id)}
                              aria-label={`Delete ${t.name}`}
                            >
                              <Trash2 className="size-3.5 text-red-400" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
