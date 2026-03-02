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
  FileText,
} from "lucide-react";
import { canControlBot } from "@/utils/roles";
import { PlatformBadges } from "@/components/platform-badges";

interface TemplateFormState {
  name: string;
  content: string;
  embedJson: string;
}

const emptyForm: TemplateFormState = {
  name: "",
  content: "",
  embedJson: "",
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.discordTemplates.list.queryOptions().queryKey;

  const { data: discordStatus, isLoading: isStatusLoading } = useQuery(
    trpc.discordGuild.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canControlBot(profile?.role ?? "USER");

  const { data: templates, isLoading } = useQuery(
    trpc.discordTemplates.list.queryOptions()
  );

  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const createMutation = useMutation(
    trpc.discordTemplates.create.mutationOptions({
      onSuccess: () => {
        toast.success("Template created.");
        setForm(emptyForm);
        setShowForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.discordTemplates.update.mutationOptions({
      onSuccess: () => {
        toast.success("Template updated.");
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.discordTemplates.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Template deleted.");
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (!form.content.trim() && !form.embedJson.trim()) {
      toast.error("Provide either content or embed JSON.");
      return;
    }

    if (form.embedJson.trim()) {
      try {
        JSON.parse(form.embedJson);
      } catch {
        toast.error("Invalid embed JSON.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      content: form.content.trim() || undefined,
      embedJson: form.embedJson.trim() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function startEdit(template: {
    id: string;
    name: string;
    content: string | null;
    embedJson: string | null;
  }) {
    setForm({
      name: template.name,
      content: template.content ?? "",
      embedJson: template.embedJson ?? "",
    });
    setEditingId(template.id);
    setShowForm(true);
  }

  if (isStatusLoading) {
    return (
      <div>
        <h1 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
          Templates <PlatformBadges platforms={["discord"]} />
        </h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!discordStatus) {
    return (
      <div>
        <h1 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
          Templates <PlatformBadges platforms={["discord"]} />
        </h1>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Link a Discord server first to manage templates.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
          Templates <PlatformBadges platforms={["discord"]} />
        </h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
          Templates <PlatformBadges platforms={["discord"]} />
        </h1>
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
            New Template
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {showForm && canManage && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <Input
                  placeholder="Template name (alphanumeric, hyphens, underscores)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Content
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Message content (supports {server}, {user}, {memberCount} variables)"
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Embed JSON (optional)
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder='{"title": "...", "description": "...", "color": 43757}'
                  value={form.embedJson}
                  onChange={(e) =>
                    setForm({ ...form, embedJson: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={
                    !form.name.trim() ||
                    (!form.content.trim() && !form.embedJson.trim()) ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {editingId ? "Save Changes" : "Create Template"}
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

        {(templates?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
            <FileText className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No templates yet. Templates are reusable message blueprints for
              Discord.
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
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Content Preview
                  </th>
                  {canManage && (
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates?.map((t) => {
                  const hasContent = !!t.content;
                  const hasEmbed = !!t.embedJson;
                  const types = [
                    hasContent ? "Text" : "",
                    hasEmbed ? "Embed" : "",
                  ]
                    .filter(Boolean)
                    .join(" + ");

                  return (
                    <tr
                      key={t.id}
                      className="transition-colors hover:bg-surface-raised"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {t.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-brand-discord/15 px-2 py-0.5 text-xs font-medium text-brand-discord">
                          {types}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                        <span className="line-clamp-1">
                          {t.content || "(embed only)"}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
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
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Templates support variables: {"{server}"}, {"{user}"},{" "}
          {"{memberCount}"}. Use them in both content and embed JSON.
        </p>
      </div>
    </div>
  );
}
