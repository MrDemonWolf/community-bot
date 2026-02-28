"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Shield,
  Save,
  Plus,
  X,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";

interface FilterState {
  capsEnabled: boolean;
  capsMinLength: number;
  capsMaxPercent: number;
  linksEnabled: boolean;
  linksAllowSubs: boolean;
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

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-main focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-brand-main" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
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
  const [newBannedWord, setNewBannedWord] = useState("");

  useEffect(() => {
    if (filterData && !form) {
      setForm({
        capsEnabled: filterData.capsEnabled,
        capsMinLength: filterData.capsMinLength,
        capsMaxPercent: filterData.capsMaxPercent,
        linksEnabled: filterData.linksEnabled,
        linksAllowSubs: filterData.linksAllowSubs,
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
      });
    }
  }, [filterData, form]);

  const updateMutation = useMutation(
    trpc.spamFilter.update.mutationOptions({
      onSuccess: () => {
        toast.success("Spam filter settings saved.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSave() {
    if (!form) return;
    updateMutation.mutate(form as any);
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

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Moderation</h1>
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
        <h1 className="mb-6 text-2xl font-bold text-foreground">Moderation</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
        {canManage && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            <Save className="size-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Global Settings */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <h2 className="text-sm font-semibold text-foreground">
              Global Settings
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Exempt Level
                </label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.exemptLevel}
                  onChange={(e) =>
                    setForm({ ...form, exemptLevel: e.target.value })
                  }
                  disabled={!canManage}
                >
                  {ACCESS_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
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
          </CardContent>
        </Card>

        {/* Caps Filter */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Caps Filter
              </h2>
              <Toggle
                checked={form.capsEnabled}
                onChange={(v) => setForm({ ...form, capsEnabled: v })}
                disabled={!canManage}
              />
            </div>
            {form.capsEnabled && (
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
            )}
          </CardContent>
        </Card>

        {/* Links Filter */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Links Filter
              </h2>
              <Toggle
                checked={form.linksEnabled}
                onChange={(v) => setForm({ ...form, linksEnabled: v })}
                disabled={!canManage}
              />
            </div>
            {form.linksEnabled && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Allow Subscribers
                </label>
                <Toggle
                  checked={form.linksAllowSubs}
                  onChange={(v) => setForm({ ...form, linksAllowSubs: v })}
                  disabled={!canManage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Symbols Filter */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Symbols Filter
              </h2>
              <Toggle
                checked={form.symbolsEnabled}
                onChange={(v) => setForm({ ...form, symbolsEnabled: v })}
                disabled={!canManage}
              />
            </div>
            {form.symbolsEnabled && (
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
            )}
          </CardContent>
        </Card>

        {/* Emotes Filter */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Emotes Filter
              </h2>
              <Toggle
                checked={form.emotesEnabled}
                onChange={(v) => setForm({ ...form, emotesEnabled: v })}
                disabled={!canManage}
              />
            </div>
            {form.emotesEnabled && (
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
            )}
          </CardContent>
        </Card>

        {/* Repetition Filter */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Repetition Filter
              </h2>
              <Toggle
                checked={form.repetitionEnabled}
                onChange={(v) => setForm({ ...form, repetitionEnabled: v })}
                disabled={!canManage}
              />
            </div>
            {form.repetitionEnabled && (
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
            )}
          </CardContent>
        </Card>

        {/* Banned Words Filter */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Banned Words
              </h2>
              <Toggle
                checked={form.bannedWordsEnabled}
                onChange={(v) => setForm({ ...form, bannedWordsEnabled: v })}
                disabled={!canManage}
              />
            </div>
            {form.bannedWordsEnabled && (
              <div className="space-y-2">
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
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Spam filters protect your chat from unwanted content. Mods and
          broadcasters are always exempt. Use !permit to temporarily allow a user
          to bypass filters.
        </p>
      </div>
    </div>
  );
}
