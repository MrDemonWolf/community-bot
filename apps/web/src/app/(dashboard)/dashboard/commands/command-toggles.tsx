"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { canControlBot } from "@/utils/roles";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCESS_LEVELS = [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
] as const;

function formatAccessLevel(level: string): string {
  return level
    .split("_")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

export default function CommandToggles() {
  const queryClient = useQueryClient();
  const queryKey = trpc.botChannel.getStatus.queryOptions().queryKey;

  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canControl = canControlBot(profile?.role ?? "USER");

  const { data: botStatus, isLoading } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );

  const toggleMutation = useMutation(
    trpc.botChannel.updateCommandToggles.mutationOptions({
      onSuccess: () => {
        toast.success("Command toggles updated.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const accessMutation = useMutation(
    trpc.botChannel.updateCommandAccessLevel.mutationOptions({
      onSuccess: () => {
        toast.success("Access level updated.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
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
    accessMutation.mutate({ commandName, accessLevel: accessLevel as typeof ACCESS_LEVELS[number] });
  };

  const isPending = toggleMutation.isPending || accessMutation.isPending;

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

      <div className="glass overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Command
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Access Level
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Enabled
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DEFAULT_COMMANDS.map((cmd) => {
              const isDisabled = disabledCommands.has(cmd.name);
              const currentAccess = overrides.get(cmd.name) ?? cmd.accessLevel;

              return (
                <tr
                  key={cmd.name}
                  className={`transition-colors hover:bg-surface-raised ${isDisabled ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-sm text-brand-main">
                    !{cmd.name}
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
                      <Select value={currentAccess} onValueChange={(v) => { if (v) handleAccessChange(cmd.name, v); }} disabled={isPending || isDisabled}>
                        <SelectTrigger size="sm">
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
                        {formatAccessLevel(currentAccess)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {canControl ? (
                      isPending ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={!isDisabled}
                          onCheckedChange={() => handleToggle(cmd.name)}
                          disabled={isPending}
                          aria-label={`Toggle ${cmd.name}`}
                        />
                      )
                    ) : (
                      <span className={`text-xs ${!isDisabled ? "text-green-500" : "text-muted-foreground"}`}>
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
  );
}
