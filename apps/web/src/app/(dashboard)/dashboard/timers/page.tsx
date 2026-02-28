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
  Pencil,
  Timer,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";

interface TimerFormState {
  name: string;
  message: string;
  intervalMinutes: number;
  chatLines: number;
}

const emptyForm: TimerFormState = {
  name: "",
  message: "",
  intervalMinutes: 5,
  chatLines: 0,
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
    trpc.timer.create.mutationOptions({
      onSuccess: () => {
        toast.success("Timer created.");
        setForm(emptyForm);
        setShowForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.timer.update.mutationOptions({
      onSuccess: () => {
        toast.success("Timer updated.");
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.timer.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Timer deleted.");
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const toggleMutation = useMutation(
    trpc.timer.toggleEnabled.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Timer ${data.enabled ? "enabled" : "disabled"}.`);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSubmit() {
    if (!form.name.trim() || !form.message.trim()) return;
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: form.name.trim(),
        message: form.message.trim(),
        intervalMinutes: form.intervalMinutes,
        chatLines: form.chatLines,
      });
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        message: form.message.trim(),
        intervalMinutes: form.intervalMinutes,
        chatLines: form.chatLines,
      });
    }
  }

  function startEdit(timer: {
    id: string;
    name: string;
    message: string;
    intervalMinutes: number;
    chatLines: number;
  }) {
    setForm({
      name: timer.name,
      message: timer.message,
      intervalMinutes: timer.intervalMinutes,
      chatLines: timer.chatLines,
    });
    setEditingId(timer.id);
    setShowForm(true);
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Timers</h1>
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
        <h1 className="mb-6 text-2xl font-bold text-foreground">Timers</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Timers</h1>
        {canManage && !showForm && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
            <Plus className="size-3.5" />
            New Timer
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Create/Edit Form */}
        {showForm && canManage && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Name
                  </label>
                  <Input
                    placeholder="Timer name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Message
                </label>
                <Input
                  placeholder="Timer message (supports variables like {uptime}, {game}, etc.)"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
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

        {/* Timers Table */}
        {(timers?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <Timer className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No timers yet. Timers post recurring messages to chat at set intervals.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Message
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Interval
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Chat Lines
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  {canManage && (
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {timers?.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {t.name}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                      <span className="line-clamp-1">{t.message}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {t.intervalMinutes}m
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {t.chatLines || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.enabled
                            ? "bg-green-500/15 text-green-500"
                            : "bg-muted-foreground/15 text-muted-foreground"
                        }`}
                      >
                        {t.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => toggleMutation.mutate({ id: t.id })}
                            disabled={toggleMutation.isPending}
                            aria-label={
                              t.enabled ? "Disable timer" : "Enable timer"
                            }
                          >
                            {t.enabled ? (
                              <ToggleRight className="size-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="size-4 text-muted-foreground" />
                            )}
                          </Button>
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
                              onClick={() => setDeleteConfirmId(t.id)}
                              aria-label={`Delete ${t.name}`}
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

        <p className="text-xs text-muted-foreground">
          Timers only fire when the stream is live. Chat lines threshold requires a minimum number of chat messages between posts.
        </p>
      </div>
    </div>
  );
}
