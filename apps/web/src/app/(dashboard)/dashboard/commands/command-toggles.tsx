"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { withToast } from "@/hooks/use-toast-mutation";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { canControlBot } from "@/utils/roles";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAccessLevel, ACCESS_LEVELS } from "@/lib/format";

export default function CommandToggles() {
  const queryClient = useQueryClient();
  const queryKey = trpc.botChannel.getStatus.queryOptions().queryKey;

  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canControl = canControlBot(profile?.role ?? "USER");

  const { data: botStatus, isLoading } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );

  const [search, setSearch] = useState("");

  const toggleMutation = useMutation(
    withToast(trpc.botChannel.updateCommandToggles.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    }), "Command toggles updated.")
  );

  const accessMutation = useMutation(
    withToast(trpc.botChannel.updateCommandAccessLevel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    }), "Access level updated.")
  );

  if (isLoading) return null;

  const botChannel = botStatus?.botChannel;

  if (!botChannel?.enabled) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center gap-3">
          <AlertCircle className="size-5 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            Enable the bot for your channel first to manage default commands.
          </p>
        </CardContent>
      </Card>
    );
  }

  const disabledCommands = new Set(botChannel.disabledCommands);
  const overrides = new Map(
    botChannel.commandOverrides.map((o) => [o.commandName, o.accessLevel])
  );

  const handleToggle = (commandName: string) => {
    const newDisabled = new Set(disabledCommands);
    if (newDisabled.has(commandName)) {
      newDisabled.delete(commandName);
    } else {
      newDisabled.add(commandName);
    }
    toggleMutation.mutate({ disabledCommands: [...newDisabled] });
  };

  const handleAccessChange = (commandName: string, accessLevel: string) => {
    accessMutation.mutate({
      commandName,
      accessLevel: accessLevel as (typeof ACCESS_LEVELS)[number],
    });
  };

  const pendingToggleCmd = toggleMutation.isPending
    ? "toggle"
    : accessMutation.isPending
      ? accessMutation.variables?.commandName
      : null;

  const filteredDefaults = DEFAULT_COMMANDS.filter((cmd) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cmd.name.includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.aliases.some((a) => a.includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Default Commands
        </h2>
        <p className="text-sm text-muted-foreground">
          Toggle built-in commands on or off, and customize their access levels.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search default commands..."
          className="pl-8"
        />
      </div>

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
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Access Level
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Enabled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDefaults.map((cmd) => {
                const isDisabled = disabledCommands.has(cmd.name);
                const currentAccess =
                  overrides.get(cmd.name) ?? cmd.accessLevel;
                const isRowPending =
                  pendingToggleCmd === "toggle" ||
                  pendingToggleCmd === cmd.name;

                return (
                  <tr
                    key={cmd.name}
                    className={`transition-colors hover:bg-surface-raised ${isDisabled ? "opacity-50" : ""}`}
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {cmd.description}
                    </td>
                    <td className="px-4 py-3">
                      {canControl ? (
                        <Select
                          value={currentAccess}
                          onValueChange={(v) => {
                            if (v) handleAccessChange(cmd.name, v);
                          }}
                          disabled={isRowPending || isDisabled}
                        >
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCESS_LEVELS.map((level) => (
                              <SelectItem key={level} value={level}>
                                {formatAccessLevel(level)}
                                {level === cmd.accessLevel
                                  ? " (default)"
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatAccessLevel(currentAccess)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canControl ? (
                        isRowPending ? (
                          <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={!isDisabled}
                            onCheckedChange={() => handleToggle(cmd.name)}
                            disabled={isRowPending}
                            aria-label={`Toggle ${cmd.name}`}
                          />
                        )
                      ) : (
                        <span
                          className={`text-xs ${!isDisabled ? "text-green-500" : "text-muted-foreground"}`}
                        >
                          {!isDisabled ? "On" : "Off"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="grid gap-3 md:hidden">
        {filteredDefaults.map((cmd) => {
          const isDisabled = disabledCommands.has(cmd.name);
          const currentAccess = overrides.get(cmd.name) ?? cmd.accessLevel;
          const isRowPending =
            pendingToggleCmd === "toggle" || pendingToggleCmd === cmd.name;

          return (
            <div
              key={cmd.name}
              className={`rounded-lg border border-border bg-card p-4 transition-opacity ${isDisabled ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-sm font-medium text-brand-main">
                    !{cmd.name}
                  </span>
                  {cmd.aliases.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      Aliases: {cmd.aliases.map((a) => `!${a}`).join(", ")}
                    </p>
                  )}
                </div>
                {canControl ? (
                  isRowPending ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={!isDisabled}
                      onCheckedChange={() => handleToggle(cmd.name)}
                      disabled={isRowPending}
                      aria-label={`Toggle ${cmd.name}`}
                    />
                  )
                ) : (
                  <span
                    className={`text-xs ${!isDisabled ? "text-green-500" : "text-muted-foreground"}`}
                  >
                    {!isDisabled ? "On" : "Off"}
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {cmd.description}
              </p>

              <div className="mt-3 border-t border-border pt-3">
                {canControl ? (
                  <Select
                    value={currentAccess}
                    onValueChange={(v) => {
                      if (v) handleAccessChange(cmd.name, v);
                    }}
                    disabled={isRowPending || isDisabled}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {formatAccessLevel(level)}
                          {level === cmd.accessLevel ? " (default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Access: {formatAccessLevel(currentAccess)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
