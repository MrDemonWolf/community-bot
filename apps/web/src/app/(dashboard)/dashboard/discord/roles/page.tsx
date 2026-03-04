"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ShieldCheck,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { canControlBot } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

const STYLE_LABELS: Record<number, { label: string; className: string }> = {
  1: { label: "Primary", className: "bg-brand-discord/15 text-brand-discord" },
  2: { label: "Secondary", className: "bg-muted-foreground/15 text-muted-foreground" },
  3: { label: "Success", className: "bg-green-500/15 text-green-500" },
  4: { label: "Danger", className: "bg-red-500/15 text-red-500" },
};

interface PanelFormState {
  name: string;
  title: string;
  description: string;
  useMenu: boolean;
}

const emptyPanelForm: PanelFormState = {
  name: "",
  title: "Role Selection",
  description: "Click a button or select an option to toggle a role.",
  useMenu: false,
};

interface ButtonFormState {
  roleId: string;
  label: string;
  emoji: string;
  style: number;
}

const emptyButtonForm: ButtonFormState = {
  roleId: "",
  label: "",
  emoji: "",
  style: 1,
};

export default function RolePanelsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.discordRoles.listPanels.queryOptions().queryKey;

  const { data: discordStatus } = useQuery(
    trpc.discordGuild.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canControlBot(profile?.role ?? "USER");

  const { data: panels, isLoading } = useQuery(
    trpc.discordRoles.listPanels.queryOptions()
  );

  const { data: roles } = useQuery(
    trpc.discordGuild.getGuildRoles.queryOptions(undefined, {
      enabled: !!discordStatus,
    })
  );

  const [panelForm, setPanelForm] = useState<PanelFormState>(emptyPanelForm);
  const [showPanelForm, setShowPanelForm] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [buttonForm, setButtonForm] = useState<ButtonFormState>(emptyButtonForm);
  const [showButtonForm, setShowButtonForm] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  // Panel mutations
  const createPanelMutation = useMutation(
    trpc.discordRoles.createPanel.mutationOptions({
      onSuccess: () => {
        toast.success("Panel created.");
        setPanelForm(emptyPanelForm);
        setShowPanelForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updatePanelMutation = useMutation(
    trpc.discordRoles.updatePanel.mutationOptions({
      onSuccess: () => {
        toast.success("Panel updated.");
        setPanelForm(emptyPanelForm);
        setEditingPanelId(null);
        setShowPanelForm(false);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deletePanelMutation = useMutation(
    trpc.discordRoles.deletePanel.mutationOptions({
      onSuccess: () => {
        toast.success("Panel deleted.");
        setDeleteConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Button mutations
  const addButtonMutation = useMutation(
    trpc.discordRoles.addButton.mutationOptions({
      onSuccess: () => {
        toast.success("Role added to panel.");
        setButtonForm(emptyButtonForm);
        setShowButtonForm(null);
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeButtonMutation = useMutation(
    trpc.discordRoles.removeButton.mutationOptions({
      onSuccess: () => {
        toast.success("Role removed from panel.");
        invalidateAll();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handlePanelSubmit() {
    if (!panelForm.name.trim()) return;

    if (editingPanelId) {
      updatePanelMutation.mutate({
        id: editingPanelId,
        title: panelForm.title,
        description: panelForm.description,
        useMenu: panelForm.useMenu,
      });
    } else {
      createPanelMutation.mutate({
        name: panelForm.name.trim(),
        title: panelForm.title,
        description: panelForm.description,
        useMenu: panelForm.useMenu,
      });
    }
  }

  function handleButtonSubmit(panelId: string) {
    if (!buttonForm.roleId || !buttonForm.label.trim()) return;

    addButtonMutation.mutate({
      panelId,
      roleId: buttonForm.roleId,
      label: buttonForm.label.trim(),
      emoji: buttonForm.emoji.trim() || undefined,
      style: buttonForm.style,
    });
  }

  function startEditPanel(panel: {
    id: string;
    name: string;
    title: string | null;
    description: string | null;
    useMenu: boolean;
  }) {
    setPanelForm({
      name: panel.name,
      title: panel.title ?? "Role Selection",
      description: panel.description ?? "",
      useMenu: panel.useMenu,
    });
    setEditingPanelId(panel.id);
    setShowPanelForm(true);
  }

  if (!discordStatus) {
    return (
      <div>
        <PageHeader title="Role Panels" platforms={["discord"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Link a Discord server first to manage role panels.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Role Panels" platforms={["discord"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Role Panels" platforms={["discord"]}>
        {canManage && !showPanelForm && (
          <Button
            size="sm"
            onClick={() => {
              setPanelForm(emptyPanelForm);
              setEditingPanelId(null);
              setShowPanelForm(true);
            }}
          >
            <Plus className="size-3.5" />
            New Panel
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4">
        {/* Create/Edit Panel Form */}
        {showPanelForm && canManage && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Name
                  </label>
                  <Input
                    placeholder="Panel name (alphanumeric, hyphens, underscores)"
                    value={panelForm.name}
                    onChange={(e) =>
                      setPanelForm({ ...panelForm, name: e.target.value })
                    }
                    disabled={!!editingPanelId}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Mode
                  </label>
                  <Select
                    value={panelForm.useMenu ? "menu" : "buttons"}
                    onValueChange={(v) =>
                      setPanelForm({
                        ...panelForm,
                        useMenu: v === "menu",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buttons">Buttons</SelectItem>
                      <SelectItem value="menu">Select Menu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Embed Title
                </label>
                <Input
                  placeholder="Role Selection"
                  value={panelForm.title}
                  onChange={(e) =>
                    setPanelForm({ ...panelForm, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Embed Description
                </label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Click a button or select an option to toggle a role."
                  value={panelForm.description}
                  onChange={(e) =>
                    setPanelForm({
                      ...panelForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePanelSubmit}
                  disabled={
                    !panelForm.name.trim() ||
                    createPanelMutation.isPending ||
                    updatePanelMutation.isPending
                  }
                >
                  {editingPanelId ? "Save Changes" : "Create Panel"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowPanelForm(false);
                    setEditingPanelId(null);
                    setPanelForm(emptyPanelForm);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Panels List */}
        {(panels?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No role panels yet"
            description="Create a panel and add roles to let members self-assign roles via buttons or select menus."
          />
        ) : (
          <div className="space-y-3">
            {panels?.map((panel) => {
              const isExpanded = expandedPanel === panel.id;
              return (
                <Card key={panel.id}>
                  <CardHeader className="cursor-pointer pb-3" onClick={() => setExpandedPanel(isExpanded ? null : panel.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base">{panel.name}</CardTitle>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            panel.useMenu
                              ? "bg-brand-main/15 text-brand-main"
                              : "bg-brand-discord/15 text-brand-discord"
                          }`}
                        >
                          {panel.useMenu ? "Select Menu" : "Buttons"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            panel.messageId
                              ? "bg-green-500/15 text-green-500"
                              : "bg-muted-foreground/15 text-muted-foreground"
                          }`}
                        >
                          {panel.messageId ? "Posted" : "Not posted"}
                        </span>
                      </div>
                      {canManage && (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => startEditPanel(panel)}
                            aria-label={`Edit ${panel.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {deleteConfirmId === panel.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() =>
                                  deletePanelMutation.mutate({
                                    id: panel.id,
                                  })
                                }
                                disabled={deletePanelMutation.isPending}
                              >
                                {deletePanelMutation.isPending
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
                              onClick={() => setDeleteConfirmId(panel.id)}
                              aria-label={`Delete ${panel.name}`}
                            >
                              <Trash2 className="size-3.5 text-red-400" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-3 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">
                        {panel.buttons.length} role{panel.buttons.length === 1 ? "" : "s"} configured.
                        Post the panel in Discord with{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                          /roles post panel:{panel.name}
                        </code>
                      </p>

                      {/* Existing Buttons/Roles */}
                      {panel.buttons.length > 0 && (
                        <div className="space-y-1">
                          {panel.buttons.map((btn) => {
                            const styleInfo = STYLE_LABELS[btn.style] ?? STYLE_LABELS[1];
                            const roleName =
                              roles?.find(
                                (r: { id: string }) => r.id === btn.roleId
                              )?.name ?? btn.roleId;

                            return (
                              <div
                                key={btn.id}
                                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="size-3.5 text-muted-foreground/50" />
                                  <span className="text-sm font-medium text-foreground">
                                    {btn.label}
                                  </span>
                                  {btn.emoji && (
                                    <span className="text-sm">{btn.emoji}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    → @{roleName}
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styleInfo.className}`}
                                  >
                                    {styleInfo.label}
                                  </span>
                                </div>
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() =>
                                      removeButtonMutation.mutate({
                                        id: btn.id,
                                      })
                                    }
                                    disabled={removeButtonMutation.isPending}
                                    aria-label={`Remove ${btn.label}`}
                                  >
                                    <Trash2 className="size-3.5 text-red-400" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Button Form */}
                      {canManage && showButtonForm === panel.id && (
                        <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Role
                              </label>
                              <Select
                                value={buttonForm.roleId}
                                onValueChange={(v) =>
                                  setButtonForm({
                                    ...buttonForm,
                                    roleId: v ?? "",
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles
                                    ?.filter(
                                      (r: { id: string }) =>
                                        !panel.buttons.some(
                                          (b) => b.roleId === r.id
                                        )
                                    )
                                    .map(
                                      (r: { id: string; name: string }) => (
                                        <SelectItem key={r.id} value={r.id}>
                                          @{r.name}
                                        </SelectItem>
                                      )
                                    )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Button Label
                              </label>
                              <Input
                                placeholder="Label shown on button"
                                value={buttonForm.label}
                                onChange={(e) =>
                                  setButtonForm({
                                    ...buttonForm,
                                    label: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Emoji (optional)
                              </label>
                              <Input
                                placeholder="🎮"
                                value={buttonForm.emoji}
                                onChange={(e) =>
                                  setButtonForm({
                                    ...buttonForm,
                                    emoji: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Style
                              </label>
                              <Select
                                value={String(buttonForm.style)}
                                onValueChange={(v) =>
                                  setButtonForm({
                                    ...buttonForm,
                                    style: parseInt(v ?? "1"),
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">
                                    Primary (Blue)
                                  </SelectItem>
                                  <SelectItem value="2">
                                    Secondary (Grey)
                                  </SelectItem>
                                  <SelectItem value="3">
                                    Success (Green)
                                  </SelectItem>
                                  <SelectItem value="4">
                                    Danger (Red)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleButtonSubmit(panel.id)}
                              disabled={
                                !buttonForm.roleId ||
                                !buttonForm.label.trim() ||
                                addButtonMutation.isPending
                              }
                            >
                              Add Role
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowButtonForm(null);
                                setButtonForm(emptyButtonForm);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {canManage && showButtonForm !== panel.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setButtonForm(emptyButtonForm);
                            setShowButtonForm(panel.id);
                          }}
                        >
                          <Plus className="size-3.5" />
                          Add Role
                        </Button>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Role panels let members self-assign roles via buttons or select menus.
          Create a panel, add roles, then use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            /roles post
          </code>{" "}
          in Discord to post it. Use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            /roles refresh
          </code>{" "}
          to update an existing post after changes.
        </p>
      </div>
    </div>
  );
}
