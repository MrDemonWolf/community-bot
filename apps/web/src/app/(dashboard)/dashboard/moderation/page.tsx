"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Save,
  Plus,
  X,
  ChevronRight,
  Undo2,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterState {
  capsEnabled: boolean;
  capsMinLength: number;
  capsMaxPercent: number;
  linksEnabled: boolean;
  linksAllowSubs: boolean;
  linksAllowlist: string[];
  symbolsEnabled: boolean;
  symbolsMaxPercent: number;
  emotesEnabled: boolean;
  emotesMaxCount: number;
  repetitionEnabled: boolean;
  repetitionMaxRepeat: number;
  bannedWordsEnabled: boolean;
  bannedWords: string[];
  exemptLevel: string;
  timeoutDuration: number;
  warningMessage: string;
}

const ACCESS_LEVELS = [
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
];

function formatAccessLevel(level: string): string {
  return level
    .split("_")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

type FilterSection =
  | "caps"
  | "links"
  | "symbols"
  | "emotes"
  | "repetition"
  | "bannedWords";

function isFormDirty(form: FilterState | null, original: FilterState | null): boolean {
  if (!form || !original) return false;
  return JSON.stringify(form) !== JSON.stringify(original);
}

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const queryKey = trpc.spamFilter.get.queryOptions().queryKey;

  const { data: botStatus } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: filterData, isLoading } = useQuery(
    trpc.spamFilter.get.queryOptions()
  );

  const [form, setForm] = useState<FilterState | null>(null);
  const [originalForm, setOriginalForm] = useState<FilterState | null>(null);
  const [newBannedWord, setNewBannedWord] = useState("");
  const [newAllowlistEntry, setNewAllowlistEntry] = useState("");
  const [expanded, setExpanded] = useState<Set<FilterSection>>(new Set());

  useEffect(() => {
    if (filterData && !form) {
      const initial: FilterState = {
        capsEnabled: filterData.capsEnabled,
        capsMinLength: filterData.capsMinLength,
        capsMaxPercent: filterData.capsMaxPercent,
        linksEnabled: filterData.linksEnabled,
        linksAllowSubs: filterData.linksAllowSubs,
        linksAllowlist: filterData.linksAllowlist ?? [],
        symbolsEnabled: filterData.symbolsEnabled,
        symbolsMaxPercent: filterData.symbolsMaxPercent,
        emotesEnabled: filterData.emotesEnabled,
        emotesMaxCount: filterData.emotesMaxCount,
        repetitionEnabled: filterData.repetitionEnabled,
        repetitionMaxRepeat: filterData.repetitionMaxRepeat,
        bannedWordsEnabled: filterData.bannedWordsEnabled,
        bannedWords: filterData.bannedWords,
        exemptLevel: filterData.exemptLevel,
        timeoutDuration: filterData.timeoutDuration,
        warningMessage: filterData.warningMessage,
      };
      setForm(initial);
      setOriginalForm(initial);

      // Default expand enabled sections
      const enabledSections = new Set<FilterSection>();
      if (filterData.capsEnabled) enabledSections.add("caps");
      if (filterData.linksEnabled) enabledSections.add("links");
      if (filterData.symbolsEnabled) enabledSections.add("symbols");
      if (filterData.emotesEnabled) enabledSections.add("emotes");
      if (filterData.repetitionEnabled) enabledSections.add("repetition");
      if (filterData.bannedWordsEnabled) enabledSections.add("bannedWords");
      setExpanded(enabledSections);
    }
  }, [filterData, form]);

  const dirty = useMemo(() => isFormDirty(form, originalForm), [form, originalForm]);

  const updateMutation = useMutation(
    trpc.spamFilter.update.mutationOptions({
      onSuccess: () => {
        toast.success("Spam filter settings saved.");
        queryClient.invalidateQueries({ queryKey });
        if (form) setOriginalForm({ ...form });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSave() {
    if (!form) return;
    updateMutation.mutate(form as any);
  }

  function handleDiscard() {
    if (originalForm) {
      setForm({ ...originalForm });
    }
  }

  function toggleSection(section: FilterSection) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  function addBannedWord() {
    if (!form || !newBannedWord.trim()) return;
    if (form.bannedWords.includes(newBannedWord.trim().toLowerCase())) {
      toast.error("Word already in list.");
      return;
    }
    setForm({
      ...form,
      bannedWords: [...form.bannedWords, newBannedWord.trim().toLowerCase()],
    });
    setNewBannedWord("");
  }

  function removeBannedWord(word: string) {
    if (!form) return;
    setForm({
      ...form,
      bannedWords: form.bannedWords.filter((w) => w !== word),
    });
  }

  function addAllowlistEntry() {
    if (!form || !newAllowlistEntry.trim()) return;
    if (form.linksAllowlist.includes(newAllowlistEntry.trim())) {
      toast.error("Domain already in allowlist.");
      return;
    }
    setForm({
      ...form,
      linksAllowlist: [...form.linksAllowlist, newAllowlistEntry.trim()],
    });
    setNewAllowlistEntry("");
  }

  function removeAllowlistEntry(entry: string) {
    if (!form) return;
    setForm({
      ...form,
      linksAllowlist: form.linksAllowlist.filter((e) => e !== entry),
    });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Moderation" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Enable the bot for your channel first to manage spam filters.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !form) {
    return (
      <div>
        <PageHeader title="Moderation" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Moderation" platforms={["twitch"]} />

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {/* Global Settings - always expanded */}
          <div className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Global Settings
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Exempt Level
                </label>
                <Select
                  value={form.exemptLevel}
                  onValueChange={(v) => {
                    if (v) setForm({ ...form, exemptLevel: v });
                  }}
                  disabled={!canManage}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {formatAccessLevel(l)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Timeout (seconds)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={86400}
                  value={form.timeoutDuration}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      timeoutDuration: parseInt(e.target.value) || 5,
                    })
                  }
                  disabled={!canManage}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Warning Message
                </label>
                <Input
                  value={form.warningMessage}
                  onChange={(e) =>
                    setForm({ ...form, warningMessage: e.target.value })
                  }
                  disabled={!canManage}
                />
              </div>
            </div>
          </div>

          {/* Caps Filter */}
          <div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between p-4"
              onClick={() => toggleSection("caps")}
              aria-expanded={expanded.has("caps")}
              aria-controls="panel-caps"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    expanded.has("caps") ? "rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Caps Filter
                </h2>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={form.capsEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, capsEnabled: v })
                  }
                  disabled={!canManage}
                />
              </div>
            </button>
            {expanded.has("caps") && (
              <div id="panel-caps" className="px-4 pb-4 pl-10">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Min Message Length
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={form.capsMinLength}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          capsMinLength: parseInt(e.target.value) || 15,
                        })
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Max Uppercase %
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.capsMaxPercent}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          capsMaxPercent: parseInt(e.target.value) || 70,
                        })
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Links Filter */}
          <div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between p-4"
              onClick={() => toggleSection("links")}
              aria-expanded={expanded.has("links")}
              aria-controls="panel-links"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    expanded.has("links") ? "rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Links Filter
                </h2>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={form.linksEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, linksEnabled: v })
                  }
                  disabled={!canManage}
                />
              </div>
            </button>
            {expanded.has("links") && (
              <div id="panel-links" className="px-4 pb-4 pl-10 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Allow Subscribers
                  </label>
                  <Switch
                    checked={form.linksAllowSubs}
                    onCheckedChange={(v) =>
                      setForm({ ...form, linksAllowSubs: v })
                    }
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Domain Allowlist
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Domains or regex patterns that bypass the links filter (e.g. <code>twitch.tv</code>, <code>youtube.com</code>, <code>^https?://mysite\.com</code>)
                  </p>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="e.g. twitch.tv or ^https?://mysite\.com"
                        value={newAllowlistEntry}
                        onChange={(e) => setNewAllowlistEntry(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addAllowlistEntry();
                          }
                        }}
                      />
                      <Button size="sm" onClick={addAllowlistEntry}>
                        <Plus className="size-3.5" />
                        Add
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {form.linksAllowlist.map((entry) => (
                      <span
                        key={entry}
                        className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400"
                      >
                        {entry}
                        {canManage && (
                          <button
                            onClick={() => removeAllowlistEntry(entry)}
                            className="ml-1 text-green-400/70 hover:text-green-400"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {form.linksAllowlist.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No domains allowlisted. All links will be filtered.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Symbols Filter */}
          <div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between p-4"
              onClick={() => toggleSection("symbols")}
              aria-expanded={expanded.has("symbols")}
              aria-controls="panel-symbols"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    expanded.has("symbols") ? "rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Symbols Filter
                </h2>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={form.symbolsEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, symbolsEnabled: v })
                  }
                  disabled={!canManage}
                />
              </div>
            </button>
            {expanded.has("symbols") && (
              <div id="panel-symbols" className="px-4 pb-4 pl-10">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Max Symbols %
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.symbolsMaxPercent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        symbolsMaxPercent: parseInt(e.target.value) || 50,
                      })
                    }
                    disabled={!canManage}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Emotes Filter */}
          <div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between p-4"
              onClick={() => toggleSection("emotes")}
              aria-expanded={expanded.has("emotes")}
              aria-controls="panel-emotes"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    expanded.has("emotes") ? "rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Emotes Filter
                </h2>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={form.emotesEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, emotesEnabled: v })
                  }
                  disabled={!canManage}
                />
              </div>
            </button>
            {expanded.has("emotes") && (
              <div id="panel-emotes" className="px-4 pb-4 pl-10">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Max Emote Count
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.emotesMaxCount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        emotesMaxCount: parseInt(e.target.value) || 15,
                      })
                    }
                    disabled={!canManage}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Repetition Filter */}
          <div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between p-4"
              onClick={() => toggleSection("repetition")}
              aria-expanded={expanded.has("repetition")}
              aria-controls="panel-repetition"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    expanded.has("repetition") ? "rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Repetition Filter
                </h2>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={form.repetitionEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, repetitionEnabled: v })
                  }
                  disabled={!canManage}
                />
              </div>
            </button>
            {expanded.has("repetition") && (
              <div id="panel-repetition" className="px-4 pb-4 pl-10">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Max Repeated Characters/Words
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={100}
                    value={form.repetitionMaxRepeat}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        repetitionMaxRepeat: parseInt(e.target.value) || 10,
                      })
                    }
                    disabled={!canManage}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Banned Words Filter */}
          <div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between p-4"
              onClick={() => toggleSection("bannedWords")}
              aria-expanded={expanded.has("bannedWords")}
              aria-controls="panel-bannedWords"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    expanded.has("bannedWords") ? "rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Banned Words
                </h2>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={form.bannedWordsEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, bannedWordsEnabled: v })
                  }
                  disabled={!canManage}
                />
              </div>
            </button>
            {expanded.has("bannedWords") && (
              <div id="panel-bannedWords" className="px-4 pb-4 pl-10 space-y-2">
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add banned word/phrase..."
                      value={newBannedWord}
                      onChange={(e) => setNewBannedWord(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addBannedWord();
                        }
                      }}
                    />
                    <Button size="sm" onClick={addBannedWord}>
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {form.bannedWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400"
                    >
                      {word}
                      {canManage && (
                        <button
                          onClick={() => removeBannedWord(word)}
                          className="ml-1 text-red-400/70 hover:text-red-400"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {form.bannedWords.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No banned words added yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Save/Discard bar */}
          {canManage && dirty && (
            <div className="glass-subtle sticky bottom-0 flex items-center justify-end gap-2 border-t border-border p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={updateMutation.isPending}
              >
                <Undo2 className="size-3.5" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <Save className="size-3.5" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Spam filters protect your chat from unwanted content. Mods and
        broadcasters are always exempt. Use !permit to temporarily allow a user
        to bypass filters.
      </p>
    </div>
  );
}
