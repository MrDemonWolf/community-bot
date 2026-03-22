"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { withToast } from "@/hooks/use-toast-mutation";
import {
  AlertCircle,
  Clock,
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";
import CommandDialog from "./command-dialog";
import { canManageCommands } from "@/utils/roles";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";

function formatAccessLevel(level: string): string {
  return level
    .split("_")
    .map((w) =>
      w.length <= 3 && w === w.toUpperCase()
        ? w
        : w.charAt(0) + w.slice(1).toLowerCase()
    )
    .join(" ");
}

const ACCESS_LEVEL_COLORS: Record<string, string> = {
  EVERYONE: "bg-green-500/10 text-green-600 dark:text-green-400",
  SUBSCRIBER: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  REGULAR: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  VIP: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  MODERATOR: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  LEAD_MODERATOR: "bg-purple-600/10 text-purple-700 dark:text-purple-300",
  BROADCASTER: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const ACCESS_LEVELS = [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
] as const;

export default function CustomCommandsTab() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.chatCommand.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");
  const { data: commands, isLoading } = useQuery(
    trpc.chatCommand.list.queryOptions()
  );

  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<
    (typeof commands extends (infer T)[] | undefined ? T : never) | undefined
  >(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const toggleMutation = useMutation(
    withToast(trpc.chatCommand.toggleEnabled.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listQueryKey });
      },
    }), "Command toggled.")
  );

  const deleteMutation = useMutation(
    withToast(trpc.chatCommand.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        setDeleteConfirmId(null);
      },
    }), "Command deleted.")
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
    if (accessFilter !== "ALL" && cmd.accessLevel !== accessFilter) return false;
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
      {/* Search + Filter + Create */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={accessFilter}
            onValueChange={(v) => {
              if (v) setAccessFilter(v);
            }}
          >
            <SelectTrigger size="sm" className="w-[160px]">
              <Filter className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Levels</SelectItem>
              {ACCESS_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {formatAccessLevel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={handleCreate} size="sm">
              <Plus className="size-3.5" data-icon="inline-start" />
              Create Command
            </Button>
          )}
        </div>
      </div>

      {/* Commands List */}
      {filteredCommands.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title={
            search || accessFilter !== "ALL"
              ? "No commands match your filters."
              : "No custom commands yet."
          }
          description={
            search || accessFilter !== "ALL"
              ? "Try adjusting your search or filter criteria."
              : "Create custom chat commands for your Twitch channel."
          }
        >
          {!search && accessFilter === "ALL" && canManage && (
            <Button onClick={handleCreate} variant="outline" size="sm">
              <Plus className="size-3.5" data-icon="inline-start" />
              Create your first command
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-lg border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Command
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Response
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Cooldown
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Access Level
                    </th>
                    {canManage && (
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                    )}
                    {canManage && (
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCommands.map((cmd) => (
                    <tr
                      key={cmd.id}
                      className={`transition-colors hover:bg-surface-raised ${cmd.enabled ? "" : "opacity-50"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-brand-main">
                          !{cmd.name}
                        </span>
                        {cmd.aliases.length > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground/70">
                            {cmd.aliases.map((a) => `!${a}`).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[250px] px-4 py-3">
                        <p className="truncate text-sm text-muted-foreground">
                          {cmd.response}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{cmd.globalCooldown}s</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ACCESS_LEVEL_COLORS[cmd.accessLevel] ??
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {formatAccessLevel(cmd.accessLevel)}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          {toggleMutation.isPending &&
                          toggleMutation.variables?.id === cmd.id ? (
                            <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={cmd.enabled}
                              onCheckedChange={() =>
                                toggleMutation.mutate({ id: cmd.id })
                              }
                              disabled={toggleMutation.isPending}
                              aria-label={`Toggle ${cmd.name}`}
                            />
                          )}
                        </td>
                      )}
                      {canManage && (
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
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="grid gap-3 md:hidden">
            {filteredCommands.map((cmd) => (
              <div
                key={cmd.id}
                className={`rounded-lg border border-border bg-card p-4 transition-opacity ${cmd.enabled ? "" : "opacity-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-brand-main">
                        !{cmd.name}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          ACCESS_LEVEL_COLORS[cmd.accessLevel] ??
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {formatAccessLevel(cmd.accessLevel)}
                      </span>
                    </div>
                    {cmd.aliases.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        Aliases: {cmd.aliases.map((a) => `!${a}`).join(", ")}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(cmd)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (deleteConfirmId === cmd.id) {
                              deleteMutation.mutate({ id: cmd.id });
                            } else {
                              setDeleteConfirmId(cmd.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          {deleteConfirmId === cmd.id
                            ? "Confirm Delete"
                            : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {cmd.response}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {cmd.globalCooldown}s cooldown
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {cmd.enabled ? "On" : "Off"}
                      </span>
                      {toggleMutation.isPending &&
                      toggleMutation.variables?.id === cmd.id ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={cmd.enabled}
                          onCheckedChange={() =>
                            toggleMutation.mutate({ id: cmd.id })
                          }
                          disabled={toggleMutation.isPending}
                          aria-label={`Toggle ${cmd.name}`}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CommandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        command={editingCommand}
      />
    </div>
  );
}
