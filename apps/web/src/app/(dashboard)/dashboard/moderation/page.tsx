"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Save,
  Type,
  Link,
  Hash,
  Smile,
  Repeat,
  Ban,
  Settings2,
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
  exemptLevel: "EVERYONE" | "SUBSCRIBER" | "REGULAR" | "VIP" | "MODERATOR" | "LEAD_MODERATOR" | "BROADCASTER";
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
] as const;

type ExemptLevel = FilterState["exemptLevel"];

function isValidExemptLevel(value: string): value is ExemptLevel {
  return (ACCESS_LEVELS as readonly string[]).includes(value);
}

function formatAccessLevel(level: string): string {
  return level
    .split("_")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

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
        exemptLevel: isValidExemptLevel(filterData.exemptLevel) ? filterData.exemptLevel : "MODERATOR",
        timeoutDuration: filterData.timeoutDuration,
        warningMessage: filterData.warningMessage,
      };
      setForm(initial);
      setOriginalForm(initial);
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
    updateMutation.mutate(form);
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Spam Filters" platforms={["twitch"]} />
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
        <PageHeader title="Spam Filters" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Spam Filters" platforms={["twitch"]} />

      {/* Global Settings */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-brand-main" />
            <CardTitle className="text-base">Global Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Exempt Level
              </label>
              <Select
                value={form.exemptLevel}
                onValueChange={(v) => {
                  if (v && isValidExemptLevel(v)) setForm({ ...form, exemptLevel: v });
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
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
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
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
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

      {/* Filter Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Caps Filter */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Type className="size-4 text-brand-main" />
              <CardTitle className="text-sm font-semibold">Caps Filter</CardTitle>
            </div>
            <Switch
              checked={form.capsEnabled}
              onCheckedChange={(v) => setForm({ ...form, capsEnabled: v })}
              disabled={!canManage}
              className="data-[state=checked]:bg-brand-main"
            />
          </CardHeader>
          {form.capsEnabled && (
            <CardContent className="space-y-3 border-t border-border pt-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Messages shorter than this are ignored.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Max Caps Percentage
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Timeout if uppercase exceeds this percentage.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Links Filter */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Link className="size-4 text-brand-main" />
              <CardTitle className="text-sm font-semibold">Links Filter</CardTitle>
            </div>
            <Switch
              checked={form.linksEnabled}
              onCheckedChange={(v) => setForm({ ...form, linksEnabled: v })}
              disabled={!canManage}
              className="data-[state=checked]:bg-brand-main"
            />
          </CardHeader>
          {form.linksEnabled && (
            <CardContent className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allow-subs"
                  checked={form.linksAllowSubs}
                  onCheckedChange={(v) =>
                    setForm({ ...form, linksAllowSubs: v === true })
                  }
                  disabled={!canManage}
                />
                <label htmlFor="allow-subs" className="text-sm text-foreground cursor-pointer">
                  Allow subscribers to post links
                </label>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Permitted Domains
                </label>
                <Textarea
                  placeholder={"twitch.tv\nyoutube.com\nclips.twitch.tv"}
                  value={form.linksAllowlist.join("\n")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      linksAllowlist: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  rows={4}
                  disabled={!canManage}
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  One domain or regex pattern per line.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Symbols Filter */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-brand-main" />
              <CardTitle className="text-sm font-semibold">Symbols Filter</CardTitle>
            </div>
            <Switch
              checked={form.symbolsEnabled}
              onCheckedChange={(v) => setForm({ ...form, symbolsEnabled: v })}
              disabled={!canManage}
              className="data-[state=checked]:bg-brand-main"
            />
          </CardHeader>
          {form.symbolsEnabled && (
            <CardContent className="space-y-3 border-t border-border pt-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Max Symbols Percentage
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Timeout if symbols exceed this percentage.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Emote Filter */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Smile className="size-4 text-brand-main" />
              <CardTitle className="text-sm font-semibold">Emote Filter</CardTitle>
            </div>
            <Switch
              checked={form.emotesEnabled}
              onCheckedChange={(v) => setForm({ ...form, emotesEnabled: v })}
              disabled={!canManage}
              className="data-[state=checked]:bg-brand-main"
            />
          </CardHeader>
          {form.emotesEnabled && (
            <CardContent className="space-y-3 border-t border-border pt-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Max Emotes Per Message
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Timeout if emote count exceeds this limit.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Repetition Filter */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Repeat className="size-4 text-brand-main" />
              <CardTitle className="text-sm font-semibold">Repetition Filter</CardTitle>
            </div>
            <Switch
              checked={form.repetitionEnabled}
              onCheckedChange={(v) => setForm({ ...form, repetitionEnabled: v })}
              disabled={!canManage}
              className="data-[state=checked]:bg-brand-main"
            />
          </CardHeader>
          {form.repetitionEnabled && (
            <CardContent className="space-y-3 border-t border-border pt-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Max Repeated Characters
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Timeout if characters or words repeat more than this.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Banned Words */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Ban className="size-4 text-brand-main" />
              <CardTitle className="text-sm font-semibold">Banned Words</CardTitle>
            </div>
            <Switch
              checked={form.bannedWordsEnabled}
              onCheckedChange={(v) => setForm({ ...form, bannedWordsEnabled: v })}
              disabled={!canManage}
              className="data-[state=checked]:bg-brand-main"
            />
          </CardHeader>
          {form.bannedWordsEnabled && (
            <CardContent className="space-y-3 border-t border-border pt-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Word List
                </label>
                <Textarea
                  placeholder={"badword1\nbadword2\nbadphrase"}
                  value={form.bannedWords.join("\n")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bannedWords: e.target.value
                        .split("\n")
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean),
                    })
                  }
                  rows={5}
                  disabled={!canManage}
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  One word or phrase per line. Case-insensitive.
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Save All Button */}
      {canManage && (
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !dirty}
            className="bg-brand-main text-white hover:bg-brand-main/80"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save All
          </Button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Spam filters protect your chat from unwanted content. Mods and
        broadcasters are always exempt. Use !permit to temporarily allow a user
        to bypass filters.
      </p>
    </div>
  );
}
