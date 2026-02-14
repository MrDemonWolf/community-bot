"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

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
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function CommandToggles() {
  const queryClient = useQueryClient();
  const queryKey = trpc.botChannel.getStatus.queryOptions().queryKey;

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
        <CardContent className="flex items-center gap-3 pt-4">
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Default Commands
        </h2>
        <p className="text-sm text-muted-foreground">
          Toggle built-in commands on or off, and customize their access levels.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0d1f42]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/5">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                Command
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                Description
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                Access Level
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                Enabled
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {DEFAULT_COMMANDS.map((cmd) => {
              const isDisabled = disabledCommands.has(cmd.name);
              const currentAccess = overrides.get(cmd.name) ?? cmd.accessLevel;

              return (
                <tr
                  key={cmd.name}
                  className={isDisabled ? "opacity-50" : ""}
                >
                  <td className="px-4 py-3 font-mono text-sm text-[#9146FF]">
                    !{cmd.name}
                    {cmd.aliases.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400 dark:text-white/30">
                        {cmd.aliases.map((a) => `!${a}`).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/60">
                    {cmd.description}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={currentAccess}
                      onChange={(e) =>
                        handleAccessChange(cmd.name, e.target.value)
                      }
                      disabled={isPending || isDisabled}
                      className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {formatAccessLevel(level)}
                          {level === cmd.accessLevel ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(cmd.name)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center"
                      aria-label={`Toggle ${cmd.name}`}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin text-gray-400" />
                      ) : (
                        <div
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            !isDisabled
                              ? "bg-[#9146FF]"
                              : "bg-gray-300 dark:bg-white/20"
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              !isDisabled
                                ? "translate-x-5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </div>
                      )}
                    </button>
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
