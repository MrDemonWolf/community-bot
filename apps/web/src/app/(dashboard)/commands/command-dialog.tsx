"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { X } from "lucide-react";

const ACCESS_LEVELS = [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
] as const;

const RESPONSE_TYPES = ["SAY", "MENTION", "REPLY"] as const;
const STREAM_STATUSES = ["BOTH", "ONLINE", "OFFLINE"] as const;

function formatLabel(val: string): string {
  return val
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

interface CommandData {
  id: string;
  name: string;
  response: string;
  responseType: (typeof RESPONSE_TYPES)[number];
  accessLevel: (typeof ACCESS_LEVELS)[number];
  globalCooldown: number;
  userCooldown: number;
  streamStatus: (typeof STREAM_STATUSES)[number];
  aliases: string[];
  hidden: boolean;
  expiresAt: Date | string | null;
  enabled: boolean;
}

interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command?: CommandData;
}

export default function CommandDialog({
  open,
  onOpenChange,
  command,
}: CommandDialogProps) {
  const isEdit = !!command;
  const queryClient = useQueryClient();
  const listQueryKey = trpc.chatCommand.list.queryOptions().queryKey;

  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [responseType, setResponseType] =
    useState<(typeof RESPONSE_TYPES)[number]>("SAY");
  const [accessLevel, setAccessLevel] =
    useState<(typeof ACCESS_LEVELS)[number]>("EVERYONE");
  const [globalCooldown, setGlobalCooldown] = useState(0);
  const [userCooldown, setUserCooldown] = useState(0);
  const [streamStatus, setStreamStatus] =
    useState<(typeof STREAM_STATUSES)[number]>("BOTH");
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState("");
  const [hidden, setHidden] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (open) {
      if (command) {
        setName(command.name);
        setResponse(command.response);
        setResponseType(command.responseType);
        setAccessLevel(command.accessLevel);
        setGlobalCooldown(command.globalCooldown);
        setUserCooldown(command.userCooldown);
        setStreamStatus(command.streamStatus);
        setAliases([...command.aliases]);
        setHidden(command.hidden);
        setExpiresAt(
          command.expiresAt
            ? new Date(command.expiresAt).toISOString().slice(0, 16)
            : ""
        );
      } else {
        setName("");
        setResponse("");
        setResponseType("SAY");
        setAccessLevel("EVERYONE");
        setGlobalCooldown(0);
        setUserCooldown(0);
        setStreamStatus("BOTH");
        setAliases([]);
        setAliasInput("");
        setHidden(false);
        setExpiresAt("");
      }
    }
  }, [open, command]);

  const createMutation = useMutation(
    trpc.chatCommand.create.mutationOptions({
      onSuccess: () => {
        toast.success("Command created.");
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.chatCommand.update.mutationOptions({
      onSuccess: () => {
        toast.success("Command updated.");
        queryClient.invalidateQueries({ queryKey: listQueryKey });
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleAddAlias = () => {
    const alias = aliasInput.trim().toLowerCase();
    if (alias && !aliases.includes(alias)) {
      setAliases([...aliases, alias]);
    }
    setAliasInput("");
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: name.trim(),
      response: response.trim(),
      responseType,
      accessLevel,
      globalCooldown,
      userCooldown,
      streamStatus,
      aliases,
      hidden,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (isEdit && command) {
      updateMutation.mutate({ id: command.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-h-[90vh] overflow-y-auto">
        <DialogCloseButton />
        <DialogTitle>{isEdit ? "Edit Command" : "Create Command"}</DialogTitle>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cmd-name">Name</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">!</span>
              <Input
                id="cmd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="commandname"
                required
                pattern="[a-zA-Z0-9_]+"
                title="Alphanumeric and underscores only"
              />
            </div>
          </div>

          {/* Response */}
          <div className="space-y-1.5">
            <Label htmlFor="cmd-response">Response</Label>
            <textarea
              id="cmd-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="The bot will say this when the command is used"
              required
              maxLength={500}
              rows={3}
              className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-xl border bg-transparent px-2.5 py-1.5 text-xs transition-colors focus-visible:ring-1 placeholder:text-muted-foreground outline-none resize-none"
            />
          </div>

          {/* Response Type + Access Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cmd-type">Response Type</Label>
              <select
                id="cmd-type"
                value={responseType}
                onChange={(e) =>
                  setResponseType(
                    e.target.value as (typeof RESPONSE_TYPES)[number]
                  )
                }
                className="h-8 w-full rounded-xl border border-border bg-card px-2.5 text-xs text-foreground"
              >
                {RESPONSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cmd-access">Access Level</Label>
              <select
                id="cmd-access"
                value={accessLevel}
                onChange={(e) =>
                  setAccessLevel(
                    e.target.value as (typeof ACCESS_LEVELS)[number]
                  )
                }
                className="h-8 w-full rounded-xl border border-border bg-card px-2.5 text-xs text-foreground"
              >
                {ACCESS_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {formatLabel(l)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cooldowns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cmd-gcd">Global Cooldown (s)</Label>
              <Input
                id="cmd-gcd"
                type="number"
                min={0}
                max={3600}
                value={globalCooldown}
                onChange={(e) => setGlobalCooldown(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cmd-ucd">User Cooldown (s)</Label>
              <Input
                id="cmd-ucd"
                type="number"
                min={0}
                max={3600}
                value={userCooldown}
                onChange={(e) => setUserCooldown(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Stream Status */}
          <div className="space-y-1.5">
            <Label htmlFor="cmd-stream">Stream Status</Label>
            <select
              id="cmd-stream"
              value={streamStatus}
              onChange={(e) =>
                setStreamStatus(
                  e.target.value as (typeof STREAM_STATUSES)[number]
                )
              }
              className="h-8 w-full rounded-xl border border-border bg-card px-2.5 text-xs text-foreground"
            >
              {STREAM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Aliases */}
          <div className="space-y-1.5">
            <Label>Aliases</Label>
            <div className="flex gap-2">
              <Input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Add alias..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlias();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAlias}
              >
                Add
              </Button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {aliases.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-1 rounded-md bg-brand-twitch/10 px-2 py-0.5 text-xs text-brand-twitch"
                  >
                    !{alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="text-brand-twitch/60 hover:text-brand-twitch"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Hidden */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="cmd-hidden"
              checked={hidden}
              onCheckedChange={(val) => setHidden(!!val)}
            />
            <Label htmlFor="cmd-hidden">Hidden from command list</Label>
          </div>

          {/* Expiry */}
          <div className="space-y-1.5">
            <Label htmlFor="cmd-expires">
              Expiry{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="cmd-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create Command"}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
