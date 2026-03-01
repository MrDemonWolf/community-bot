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
import { X, ChevronDown } from "lucide-react";
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

          {/* Variable Reference */}
          <details className="group rounded-lg border border-border bg-card/50 text-xs">
            <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-muted-foreground hover:text-foreground select-none">
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              Variable Reference
            </summary>
            <div className="space-y-3 px-3 pb-3 pt-1 text-muted-foreground">
              <div>
                <p className="mb-1 font-medium text-foreground">Basic</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span><code>{"{user}"}</code> — caller username</span>
                  <span><code>{"{touser}"}</code> — first arg or caller</span>
                  <span><code>{"{channel}"}</code> — channel name</span>
                  <span><code>{"{query}"}</code> — all args or caller</span>
                  <span><code>{"{args}"}</code> — all arguments</span>
                  <span><code>{"{querystring}"}</code> — URL-encoded args</span>
                  <span><code>{"{displayname}"}</code> — display name</span>
                  <span><code>{"{userid}"}</code> — Twitch user ID</span>
                  <span><code>{"{userlevel}"}</code> — caller role</span>
                  <span><code>{"{count}"}</code> — use count</span>
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">Stream</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span><code>{"{uptime}"}</code> — stream uptime</span>
                  <span><code>{"{downtime}"}</code> — time since offline</span>
                  <span><code>{"{title}"}</code> — stream title</span>
                  <span><code>{"{game}"}</code> — current game</span>
                  <span><code>{"{gamesplayed}"}</code> — games this session</span>
                  <span><code>{"{chatters}"}</code> — active chatter count</span>
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">User Info</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span><code>{"{followage}"}</code> — follow duration</span>
                  <span><code>{"{accountage}"}</code> — account age</span>
                  <span><code>{"{subcount}"}</code> — subscriber count</span>
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">Emotes</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span><code>{"{7tvemotes}"}</code> — 7TV emotes</span>
                  <span><code>{"{bttvemotes}"}</code> — BTTV emotes</span>
                  <span><code>{"{ffzemotes}"}</code> — FFZ emotes</span>
                  <span><code>{"{twitchemotes}"}</code> — Twitch emotes</span>
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">Utility</p>
                <div className="grid gap-y-0.5">
                  <span><code>{"${N}"}</code> / <code>{"${N|fallback}"}</code> — positional arg</span>
                  <span><code>{"${random.pick 'a' 'b'}"}</code> — random choice</span>
                  <span><code>{"${random.chatter}"}</code> — random chatter</span>
                  <span><code>{"${time America/Chicago}"}</code> — current time</span>
                  <span><code>{"{random.1-100}"}</code> — random number</span>
                  <span><code>{"{math 2+3*4}"}</code> — math expression</span>
                  <span><code>{"{countdown 2026-12-25T00:00:00}"}</code> — time until</span>
                  <span><code>{"{countup 2024-01-01}"}</code> — time since</span>
                  <span><code>{"{repeat 'text' 3}"}</code> — repeat text</span>
                  <span><code>{"{urlencode text}"}</code> — URL encode</span>
                  <span><code>{"{customapi https://...}"}</code> — fetch URL</span>
                  <span><code>{"{weather Austin, TX}"}</code> — current weather</span>
                </div>
              </div>
            </div>
          </details>

          {/* Response Type + Access Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Response Type</Label>
              <Select value={responseType} onValueChange={(v) => { if (v) setResponseType(v as (typeof RESPONSE_TYPES)[number]); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Access Level</Label>
              <Select value={accessLevel} onValueChange={(v) => { if (v) setAccessLevel(v as (typeof ACCESS_LEVELS)[number]); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {formatLabel(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Label>Stream Status</Label>
            <Select value={streamStatus} onValueChange={(v) => { if (v) setStreamStatus(v as (typeof STREAM_STATUSES)[number]); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STREAM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    className="inline-flex items-center gap-1 rounded-md bg-brand-main/10 px-2 py-0.5 text-xs text-brand-main"
                  >
                    !{alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="text-brand-main/60 hover:text-brand-main"
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
