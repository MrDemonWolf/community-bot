"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Clock,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { canControlBot } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

interface ScheduleFormState {
  name: string;
  channelId: string;
  type: "ONCE" | "RECURRING";
  content: string;
  cronExpression: string;
}

const emptyForm: ScheduleFormState = {
  name: "",
  channelId: "",
  type: "RECURRING",
  content: "",
  cronExpression: "",
};

export default function ScheduledPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.discordScheduled.list.queryOptions().queryKey;

  const { data: discordStatus } = useQuery(
    trpc.discordGuild.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canControlBot(profile?.role ?? "USER");

  const { data: schedules, isLoading } = useQuery(
    trpc.discordScheduled.list.queryOptions()
  );

  const { data: channels } = useQuery(
    trpc.discordGuild.getGuildChannels.queryOptions(undefined, {
      enabled: !!discordStatus,
    })
  );

  const [form, setForm] = useState<ScheduleFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const createMutation = useMutation(
    trpc.discordScheduled.create.mutationOptions({
      onSuccess: () => {
        toast.success("Scheduled message created.");
        setForm(emptyForm);
        setShowForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.discordScheduled.update.mutationOptions({
      onSuccess: () => {
        toast.success("Schedule updated.");
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.discordScheduled.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Schedule deleted.");
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const toggleMutation = useMutation(
    trpc.discordScheduled.toggle.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Schedule ${data.enabled ? "enabled" : "disabled"}.`
        );
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSubmit() {
    if (!form.name.trim() || !form.channelId) return;
    if (!form.content.trim()) {
      toast.error("Content is required.");
      return;
    }
    if (form.type === "RECURRING" && !form.cronExpression.trim()) {
      toast.error("Cron expression is required for recurring schedules.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        content: form.content.trim(),
        cronExpression: form.cronExpression.trim() || undefined,
        channelId: form.channelId,
      });
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        channelId: form.channelId,
        type: form.type,
        content: form.content.trim(),
        cronExpression: form.cronExpression.trim() || undefined,
      });
    }
  }

  function startEdit(schedule: {
    id: string;
    name: string;
    channelId: string;
    type: string;
    content: string | null;
    cronExpression: string | null;
  }) {
    setForm({
      name: schedule.name,
      channelId: schedule.channelId,
      type: schedule.type as "ONCE" | "RECURRING",
      content: schedule.content ?? "",
      cronExpression: schedule.cronExpression ?? "",
    });
    setEditingId(schedule.id);
    setShowForm(true);
  }

  if (!discordStatus) {
    return (
      <div>
        <PageHeader title="Scheduled Messages" platforms={["discord"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Link a Discord server first to manage scheduled messages.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Scheduled Messages" platforms={["discord"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Scheduled Messages" platforms={["discord"]}>
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
            New Schedule
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4">
        {showForm && canManage && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Name
                  </label>
                  <Input
                    placeholder="Schedule name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Channel
                  </label>
                  <Select
                    value={form.channelId}
                    onValueChange={(v) =>
                      setForm({ ...form, channelId: v ?? "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels?.map(
                        (ch: { id: string; name: string }) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            #{ch.name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Type
                  </label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        type: v as "ONCE" | "RECURRING",
                      })
                    }
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECURRING">Recurring</SelectItem>
                      <SelectItem value="ONCE">Once</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.type === "RECURRING" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Cron Expression
                    </label>
                    <Input
                      placeholder="0 9 * * * (daily at 9 AM)"
                      value={form.cronExpression}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          cronExpression: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Content
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Message content"
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={
                    !form.name.trim() ||
                    !form.channelId ||
                    !form.content.trim() ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {editingId ? "Save Changes" : "Create Schedule"}
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

        {(schedules?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Clock}
            title="No scheduled messages yet"
            description="Schedule recurring or one-time messages for your Discord server."
          />
        ) : (
          <div className="glass overflow-hidden rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Schedule
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
                {schedules?.map((s) => (
                  <tr
                    key={s.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {s.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.type === "RECURRING"
                            ? "bg-brand-main/15 text-brand-main"
                            : "bg-muted-foreground/15 text-muted-foreground"
                        }`}
                      >
                        {s.type === "RECURRING" ? "Recurring" : "Once"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {s.cronExpression ?? "Manual"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.enabled
                            ? "bg-green-500/15 text-green-500"
                            : "bg-muted-foreground/15 text-muted-foreground"
                        }`}
                      >
                        {s.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              toggleMutation.mutate({
                                id: s.id,
                                enabled: !s.enabled,
                              })
                            }
                            disabled={toggleMutation.isPending}
                            aria-label={
                              s.enabled
                                ? "Disable schedule"
                                : "Enable schedule"
                            }
                          >
                            {s.enabled ? (
                              <ToggleRight className="size-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="size-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => startEdit(s)}
                            aria-label={`Edit ${s.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {deleteConfirmId === s.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() =>
                                  deleteMutation.mutate({ id: s.id })
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
                              onClick={() => setDeleteConfirmId(s.id)}
                              aria-label={`Delete ${s.name}`}
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
          Cron expressions define when recurring messages fire. Example:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            0 9 * * *
          </code>{" "}
          = daily at 9 AM.{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            0 */6 * * *
          </code>{" "}
          = every 6 hours.
        </p>
      </div>
    </div>
  );
}
