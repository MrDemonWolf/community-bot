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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { canManageCommands, canControlBot } from "@/utils/roles";
import {
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Terminal,
  Pencil,
  X,
  Check,
} from "lucide-react";

export default function CustomCommandsPage() {
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canView = canManageCommands(profile?.role ?? "USER");
  const canEdit = canControlBot(profile?.role ?? "USER");

  if (!canView) {
    return (
      <div>
        <PageHeader title="Custom Commands" platforms={["discord"]} />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You don't have permission to view custom commands.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Custom Commands" platforms={["discord"]} />
      <CommandList canEdit={canEdit} />
    </div>
  );
}

function CommandList({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edit form state
  const [editResponse, setEditResponse] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: commands, isLoading, isError, refetch } = useQuery(
    trpc.discordCustomCommands.list.queryOptions()
  );

  const createMutation = useMutation(
    trpc.discordCustomCommands.create.mutationOptions({
      onSuccess: () => {
        toast.success("Command created.");
        setShowCreate(false);
        setNewName("");
        setNewResponse("");
        setNewDescription("");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.discordCustomCommands.update.mutationOptions({
      onSuccess: () => {
        toast.success("Command updated.");
        setEditingId(null);
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.discordCustomCommands.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Command deleted.");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const toggleMutation = useMutation(
    trpc.discordCustomCommands.toggle.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Command ${data.enabled ? "enabled" : "disabled"}.`);
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const startEditing = (cmd: NonNullable<typeof commands>[number]) => {
    setEditingId(cmd.id);
    setEditResponse(cmd.response ?? "");
    setEditDescription(cmd.description);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Terminal className="size-5" />
              Custom Commands
            </CardTitle>
            <CardDescription>
              Create custom slash commands that respond with text or embeds. Use{" "}
              <code className="text-xs">/cc run &lt;name&gt;</code> to execute
              them in Discord.
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => setShowCreate(!showCreate)}
              variant={showCreate ? "outline" : "default"}
            >
              {showCreate ? (
                <X className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {showCreate ? "Cancel" : "Create"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showCreate && canEdit && (
          <div className="mb-4 space-y-3 rounded-lg border border-border bg-surface-raised/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <Input
                  placeholder="my-command"
                  value={newName}
                  onChange={(e) =>
                    setNewName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  placeholder="What this command does"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Response
              </label>
              <Input
                placeholder="Hello {user}! Welcome to {server}."
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Variables: {"{user}"}, {"{usermention}"}, {"{server}"},{" "}
                {"{channel}"}, {"{membercount}"}
              </p>
            </div>
            <Button
              size="sm"
              disabled={
                !newName.trim() ||
                !newResponse.trim() ||
                createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  name: newName.trim(),
                  response: newResponse.trim(),
                  description: newDescription.trim() || "A custom command",
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Create Command
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load commands.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !commands?.length ? (
          <EmptyState
            icon={Terminal}
            title="No custom commands yet"
            description={canEdit ? "Click Create to add one." : undefined}
          />
        ) : (
          <div className="divide-y divide-border">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <code className="rounded bg-surface-raised px-2 py-0.5 text-sm font-bold text-foreground">
                    /cc run {cmd.name}
                  </code>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      cmd.enabled
                        ? "bg-green-500/20 text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cmd.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {cmd.useCount} uses
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleMutation.mutate({ id: cmd.id })}
                        disabled={toggleMutation.isPending}
                        title={cmd.enabled ? "Disable" : "Enable"}
                      >
                        {cmd.enabled ? (
                          <ToggleRight className="size-4 text-green-400" />
                        ) : (
                          <ToggleLeft className="size-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          editingId === cmd.id
                            ? setEditingId(null)
                            : startEditing(cmd)
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => deleteMutation.mutate({ id: cmd.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {cmd.description}
                </p>
                <p className="text-sm text-foreground/80">
                  {cmd.response?.slice(0, 120)}
                  {(cmd.response?.length ?? 0) > 120 ? "..." : ""}
                </p>

                {editingId === cmd.id && canEdit && (
                  <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-raised/30 p-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Description
                      </label>
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Response
                      </label>
                      <Input
                        value={editResponse}
                        onChange={(e) => setEditResponse(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: cmd.id,
                            response: editResponse,
                            description: editDescription,
                          })
                        }
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
