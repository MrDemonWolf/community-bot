"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertCircle, Loader2, Plus, Trash2, Pencil, Coins, CheckCircle2, XCircle, Clock } from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

const ACTION_TYPES = ["RUN_COMMAND", "ADD_TO_QUEUE", "SONG_REQUEST", "CUSTOM_MESSAGE", "SHOUTOUT", "HIGHLIGHT"] as const;
type ActionType = (typeof ACTION_TYPES)[number];

interface RewardForm {
  title: string;
  cost: number;
  prompt: string;
  backgroundColor: string;
  requireUserInput: boolean;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
}

const emptyForm: RewardForm = {
  title: "",
  cost: 100,
  prompt: "",
  backgroundColor: "#9146FF",
  requireUserInput: false,
  actionType: "CUSTOM_MESSAGE",
  actionConfig: {},
};

function SyncBadge({ status }: { status: string }) {
  if (status === "synced") return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="size-3" /> Synced</span>;
  if (status === "error") return <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="size-3" /> Error</span>;
  return <span className="flex items-center gap-1 text-xs text-amber-400"><Clock className="size-3" /> Pending</span>;
}

export default function ChannelPointsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.channelPoints.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(trpc.botChannel.getStatus.queryOptions());
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: rewards, isLoading } = useQuery(trpc.channelPoints.list.queryOptions());

  const [form, setForm] = useState<RewardForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState("{}");
  const [configError, setConfigError] = useState(false);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const createMutation = useMutation(
    trpc.channelPoints.create.mutationOptions({
      onSuccess: () => { toast.success("Reward created."); setForm(emptyForm); setShowForm(false); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.channelPoints.update.mutationOptions({
      onSuccess: () => { toast.success("Reward updated."); setForm(emptyForm); setEditingId(null); setShowForm(false); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.channelPoints.delete.mutationOptions({
      onSuccess: () => { toast.success("Reward deleted."); setDeleteConfirmId(null); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  function parseConfig(): Record<string, unknown> | null {
    try { return JSON.parse(configJson); } catch { setConfigError(true); return null; }
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    const actionConfig = parseConfig();
    if (!actionConfig) { toast.error("Action config must be valid JSON."); return; }
    setConfigError(false);
    const payload = { ...form, title: form.title.trim(), actionConfig };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function startEdit(r: NonNullable<typeof rewards>[number]) {
    setForm({
      title: r.title,
      cost: r.cost,
      prompt: r.prompt ?? "",
      backgroundColor: r.backgroundColor ?? "#9146FF",
      requireUserInput: r.requireUserInput,
      actionType: r.actionType as ActionType,
      actionConfig: (r.actionConfig as Record<string, unknown>) ?? {},
    });
    setConfigJson(JSON.stringify(r.actionConfig ?? {}, null, 2));
    setEditingId(r.id);
    setShowForm(true);
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Channel Points" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">Enable the bot for your channel first to manage channel point rewards.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Channel Points" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Channel Points" platforms={["twitch"]}>
        {canManage && !showForm && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setConfigJson("{}"); setEditingId(null); setShowForm(true); }}>
            <Plus className="size-3.5" /> New Reward
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4">
        {showForm && canManage && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
                  <Input placeholder="Reward title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Cost (channel points)</label>
                  <Input type="number" min={1} max={1000000} value={form.cost} onChange={(e) => setForm({ ...form, cost: parseInt(e.target.value) || 100 })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Prompt (optional)</label>
                <Input placeholder="What should viewers do?" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} className="font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Action Type</label>
                  <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value as ActionType })}>
                    {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={form.requireUserInput} onCheckedChange={(v) => setForm({ ...form, requireUserInput: v })} />
                Require user input
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Action Config (JSON)</label>
                <textarea
                  className={`w-full rounded-md border bg-background px-3 py-2 font-mono text-xs ${configError ? "border-red-500" : "border-border"}`}
                  rows={4}
                  value={configJson}
                  onChange={(e) => { setConfigJson(e.target.value); setConfigError(false); }}
                  placeholder='{ "command": "!so {username}" }'
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSubmit} disabled={!form.title.trim() || createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Create Reward"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(rewards?.length ?? 0) === 0 ? (
          <EmptyState icon={Coins} title="No rewards yet" description="Create channel point rewards and map them to bot actions." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rewards?.map((r) => (
              <Card key={r.id} className="relative overflow-hidden">
                <div className="h-1 w-full" style={{ backgroundColor: r.backgroundColor ?? "#9146FF" }} />
                <CardContent className="pt-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.cost.toLocaleString()} points</p>
                    </div>
                    <SyncBadge status={r.syncStatus} />
                  </div>
                  {r.prompt && <p className="mb-2 text-xs text-muted-foreground line-clamp-2">{r.prompt}</p>}
                  <p className="mb-3 text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{r.actionType}</span>
                  </p>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="xs" onClick={() => startEdit(r)}>
                        <Pencil className="size-3.5 mr-1" /> Edit
                      </Button>
                      {deleteConfirmId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="destructive" size="xs" onClick={() => deleteMutation.mutate({ id: r.id })} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? "..." : "Confirm"}
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="xs" onClick={() => setDeleteConfirmId(r.id)}>
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
