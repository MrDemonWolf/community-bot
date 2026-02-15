"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import CommandDialog from "./command-dialog";

function formatAccessLevel(level: string): string {
  return level
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function CustomCommandsTab() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.chatCommand.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: commands, isLoading } = useQuery(
    trpc.chatCommand.list.queryOptions()
  );

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<
    (typeof commands extends (infer T)[] | undefined ? T : never) | undefined
  >(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const toggleMutation = useMutation(
    trpc.chatCommand.toggleEnabled.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listQueryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.chatCommand.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Command deleted.");
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        setDeleteConfirmId(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (!botStatus?.botChannel?.enabled) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center gap-3">
          <AlertCircle className="size-5 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            Enable the bot for your channel first to manage custom commands.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredCommands = (commands ?? []).filter((cmd) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cmd.name.includes(q) ||
      cmd.response.toLowerCase().includes(q) ||
      cmd.aliases.some((a) => a.includes(q))
    );
  });

  const handleEdit = (cmd: NonNullable<typeof commands>[number]) => {
    setEditingCommand(cmd);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCommand(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Search + Create */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="pl-8"
          />
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="size-3.5" data-icon="inline-start" />
          Create
        </Button>
      </div>

      {/* Commands Table */}
      {filteredCommands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">
            {search
              ? "No commands match your search."
              : "No custom commands yet."}
          </p>
          {!search && (
            <Button
              onClick={handleCreate}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Create your first command
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Command
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Response
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Access
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Enabled
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCommands.map((cmd) => (
                <tr
                  key={cmd.id}
                  className={`transition-colors hover:bg-surface-raised ${cmd.enabled ? "" : "opacity-50"}`}
                >
                  <td className="px-4 py-3 font-mono text-sm text-brand-main">
                    !{cmd.name}
                    {cmd.aliases.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground/70">
                        {cmd.aliases.map((a) => `!${a}`).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm text-muted-foreground">
                    {cmd.response}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatAccessLevel(cmd.accessLevel)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: cmd.id })}
                      disabled={toggleMutation.isPending}
                      className="inline-flex items-center justify-center"
                      aria-label={`Toggle ${cmd.name}`}
                    >
                      {toggleMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            cmd.enabled
                              ? "bg-brand-main"
                              : "bg-muted"
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              cmd.enabled
                                ? "translate-x-5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </div>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleEdit(cmd)}
                        aria-label={`Edit ${cmd.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {deleteConfirmId === cmd.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() =>
                              deleteMutation.mutate({ id: cmd.id })
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
                          onClick={() => setDeleteConfirmId(cmd.id)}
                          aria-label={`Delete ${cmd.name}`}
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CommandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        command={editingCommand}
      />
    </div>
  );
}
