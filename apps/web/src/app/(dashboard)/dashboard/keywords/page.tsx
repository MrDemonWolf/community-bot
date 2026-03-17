"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Hash,
  Info,
  X,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

interface KeywordFormState {
  name: string;
  phraseGroups: string[][];
  response: string;
  responseType: "SAY" | "MENTION" | "REPLY";
  accessLevel: "EVERYONE" | "SUBSCRIBER" | "REGULAR" | "VIP" | "MODERATOR" | "LEAD_MODERATOR" | "BROADCASTER";
  globalCooldown: number;
  userCooldown: number;
  streamStatus: "ONLINE" | "OFFLINE" | "BOTH";
  priority: number;
  stopProcessing: boolean;
  caseSensitive: boolean;
}

const emptyForm: KeywordFormState = {
  name: "",
  phraseGroups: [[""]],
  response: "",
  responseType: "SAY",
  accessLevel: "EVERYONE",
  globalCooldown: 0,
  userCooldown: 0,
  streamStatus: "BOTH",
  priority: 0,
  stopProcessing: false,
  caseSensitive: false,
};

const ACCESS_LEVELS = ["EVERYONE", "SUBSCRIBER", "REGULAR", "VIP", "MODERATOR", "LEAD_MODERATOR", "BROADCASTER"] as const;

export default function KeywordsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.keyword.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(trpc.botChannel.getStatus.queryOptions());
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: kwList, isLoading } = useQuery(trpc.keyword.list.queryOptions());

  const [form, setForm] = useState<KeywordFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const createMutation = useMutation(
    trpc.keyword.create.mutationOptions({
      onSuccess: () => { toast.success("Keyword created."); setForm(emptyForm); setShowForm(false); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.keyword.update.mutationOptions({
      onSuccess: () => { toast.success("Keyword updated."); setForm(emptyForm); setEditingId(null); setShowForm(false); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.keyword.delete.mutationOptions({
      onSuccess: () => { toast.success("Keyword deleted."); setDeleteConfirmId(null); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  const toggleMutation = useMutation(
    trpc.keyword.toggleEnabled.mutationOptions({
      onSuccess: (data) => { toast.success(`Keyword ${data.enabled ? "enabled" : "disabled"}.`); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSubmit() {
    if (!form.name.trim() || !form.response.trim()) return;
    const validGroups = form.phraseGroups
      .map((g) => g.filter((p) => p.trim()))
      .filter((g) => g.length > 0);
    if (validGroups.length === 0) { toast.error("Add at least one phrase."); return; }

    const payload = { ...form, name: form.name.trim(), phraseGroups: validGroups, response: form.response.trim() };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function startEdit(kw: NonNullable<typeof kwList>[number]) {
    setForm({
      name: kw.name,
      phraseGroups: (kw.phraseGroups as string[][]).length ? (kw.phraseGroups as string[][]) : [[""]],
      response: kw.response,
      responseType: kw.responseType as "SAY" | "MENTION" | "REPLY",
      accessLevel: kw.accessLevel,
      globalCooldown: kw.globalCooldown,
      userCooldown: kw.userCooldown,
      streamStatus: kw.streamStatus as "ONLINE" | "OFFLINE" | "BOTH",
      priority: kw.priority,
      stopProcessing: kw.stopProcessing,
      caseSensitive: kw.caseSensitive,
    });
    setEditingId(kw.id);
    setShowForm(true);
  }

  function addGroup() {
    setForm({ ...form, phraseGroups: [...form.phraseGroups, [""]] });
  }

  function removeGroup(gi: number) {
    setForm({ ...form, phraseGroups: form.phraseGroups.filter((_, i) => i !== gi) });
  }

  function addPhrase(gi: number) {
    const groups = [...form.phraseGroups];
    groups[gi] = [...(groups[gi] ?? []), ""];
    setForm({ ...form, phraseGroups: groups });
  }

  function removePhrase(gi: number, pi: number) {
    const groups = [...form.phraseGroups];
    groups[gi] = (groups[gi] ?? []).filter((_, i) => i !== pi);
    setForm({ ...form, phraseGroups: groups });
  }

  function setPhrase(gi: number, pi: number, value: string) {
    const groups = form.phraseGroups.map((g, i) =>
      i === gi ? g.map((p, j) => (j === pi ? value : p)) : g
    );
    setForm({ ...form, phraseGroups: groups });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Keywords" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">Enable the bot for your channel first to manage keywords.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Keywords" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Keywords" platforms={["twitch"]}>
        {canManage && !showForm && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
            <Plus className="size-3.5" />
            New Keyword
          </Button>
        )}
      </PageHeader>

      <div className="glass-subtle mb-4 flex items-center gap-2 rounded-lg px-3 py-2">
        <Info className="size-4 shrink-0 text-brand-main" />
        <p className="text-xs text-muted-foreground">
          Keywords auto-respond to chat messages containing matching phrases — no command prefix needed.
          Groups use OR logic; phrases within a group use AND logic.
          Prefix phrases with <code className="font-mono">regex:</code>, <code className="font-mono">sensitive:</code>, or <code className="font-mono">negative:</code>.
        </p>
      </div>

      <div className="space-y-4">
        {showForm && canManage && (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Name (identifier)</label>
                  <Input placeholder="keyword-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority (higher fires first)</label>
                  <Input type="number" min={0} max={1000} value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              {/* Phrase Groups */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Phrase Groups (OR)</label>
                  <Button size="xs" variant="outline" onClick={addGroup}>+ OR Group</Button>
                </div>
                <div className="space-y-2">
                  {form.phraseGroups.map((group, gi) => (
                    <div key={gi} className="rounded-md border border-border bg-surface-raised p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Group {gi + 1} — ALL must match</span>
                        {form.phraseGroups.length > 1 && (
                          <Button variant="ghost" size="icon-xs" onClick={() => removeGroup(gi)}>
                            <X className="size-3" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {group.map((phrase, pi) => (
                          <div key={pi} className="flex items-center gap-1">
                            <Input
                              className="h-7 text-xs"
                              placeholder='e.g. hello or regex:hel+o or negative:bad'
                              value={phrase}
                              onChange={(e) => setPhrase(gi, pi, e.target.value)}
                            />
                            {group.length > 1 && (
                              <Button variant="ghost" size="icon-xs" onClick={() => removePhrase(gi, pi)}>
                                <X className="size-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button size="xs" variant="ghost" className="h-6 text-xs" onClick={() => addPhrase(gi)}>+ AND phrase</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Response</label>
                <Input placeholder="Response message (supports {user}, {game}, etc.)" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Response Type</label>
                  <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={form.responseType} onChange={(e) => setForm({ ...form, responseType: e.target.value as KeywordFormState["responseType"] })}>
                    <option value="SAY">Say</option>
                    <option value="MENTION">Mention</option>
                    <option value="REPLY">Reply</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Access Level</label>
                  <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={form.accessLevel} onChange={(e) => setForm({ ...form, accessLevel: e.target.value as KeywordFormState["accessLevel"] })}>
                    {ACCESS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Stream Status</label>
                  <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={form.streamStatus} onChange={(e) => setForm({ ...form, streamStatus: e.target.value as KeywordFormState["streamStatus"] })}>
                    <option value="BOTH">Both</option>
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Global Cooldown (s)</label>
                  <Input type="number" min={0} max={86400} value={form.globalCooldown} onChange={(e) => setForm({ ...form, globalCooldown: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Per-user Cooldown (s)</label>
                  <Input type="number" min={0} max={86400} value={form.userCooldown} onChange={(e) => setForm({ ...form, userCooldown: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={form.caseSensitive} onCheckedChange={(v) => setForm({ ...form, caseSensitive: v })} />
                  Case sensitive
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={form.stopProcessing} onCheckedChange={(v) => setForm({ ...form, stopProcessing: v })} />
                  Stop processing after match
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSubmit} disabled={!form.name.trim() || !form.response.trim() || createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Create Keyword"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(kwList?.length ?? 0) === 0 ? (
          <EmptyState icon={Hash} title="No keywords yet" description="Keywords auto-respond when chat messages match configured phrases." />
        ) : (
          <div className="glass overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Phrases</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Response</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Priority</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Enabled</th>
                  {canManage && <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {kwList?.map((kw) => (
                  <tr key={kw.id} className="transition-colors hover:bg-surface-raised">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{kw.name}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                      {(kw.phraseGroups as string[][]).map((g, i) => (
                        <span key={i} className="mr-1">
                          {g.join(" AND ")}
                          {i < (kw.phraseGroups as string[][]).length - 1 && " | "}
                        </span>
                      ))}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                      <span className="line-clamp-1">{kw.response}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{kw.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={kw.enabled}
                        onCheckedChange={() => { if (canManage) toggleMutation.mutate({ id: kw.id }); }}
                        disabled={!canManage || toggleMutation.isPending}
                      />
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-xs" onClick={() => startEdit(kw)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {deleteConfirmId === kw.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="destructive" size="xs" onClick={() => deleteMutation.mutate({ id: kw.id })} disabled={deleteMutation.isPending}>
                                {deleteMutation.isPending ? "..." : "Confirm"}
                              </Button>
                              <Button variant="ghost" size="xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon-xs" onClick={() => setDeleteConfirmId(kw.id)}>
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
    </div>
  );
}
