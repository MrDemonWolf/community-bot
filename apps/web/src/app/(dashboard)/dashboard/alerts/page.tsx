"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertCircle, Loader2, Bell, ChevronDown, ChevronUp, X, Plus } from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";

const ALERT_TYPES = [
  { type: "follow", label: "Follow", icon: "👋" },
  { type: "subscribe", label: "Subscribe", icon: "🎉" },
  { type: "resubscribe", label: "Resub", icon: "❤️" },
  { type: "gift_sub", label: "Gift Sub", icon: "🎁" },
  { type: "gift_sub_bomb", label: "Gift Bomb", icon: "🎁🎁" },
  { type: "raid", label: "Raid", icon: "🎊" },
  { type: "cheer", label: "Cheer", icon: "💎" },
  { type: "charity_donation", label: "Charity Donation", icon: "❤️" },
  { type: "hype_train_begin", label: "Hype Train Begin", icon: "🚂" },
  { type: "hype_train_end", label: "Hype Train End", icon: "🚂💨" },
  { type: "ad_break_begin", label: "Ad Break", icon: "⚠️" },
  { type: "stream_online", label: "Stream Online", icon: "🟢" },
  { type: "stream_offline", label: "Stream Offline", icon: "🔴" },
  { type: "shoutout_received", label: "Shoutout Received", icon: "📢" },
  { type: "ban", label: "Ban", icon: "🔨" },
  { type: "vip_add", label: "VIP Added", icon: "⭐" },
  { type: "moderator_add", label: "Moderator Added", icon: "🛡️" },
] as const;

type AlertType = (typeof ALERT_TYPES)[number]["type"];

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const listQueryKey = trpc.chatAlert.list.queryOptions().queryKey;

  const { data: botStatus } = useQuery(trpc.botChannel.getStatus.queryOptions());
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: alerts, isLoading } = useQuery(trpc.chatAlert.list.queryOptions());

  const [expanded, setExpanded] = useState<AlertType | null>(null);
  const [templates, setTemplates] = useState<Record<string, string[]>>({});
  const [minThreshold, setMinThreshold] = useState<Record<string, number>>({});
  const [cooldown, setCooldown] = useState<Record<string, number>>({});

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
  }

  const upsertMutation = useMutation(
    trpc.chatAlert.upsert.mutationOptions({
      onSuccess: () => { toast.success("Alert saved."); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  const toggleMutation = useMutation(
    trpc.chatAlert.toggleEnabled.mutationOptions({
      onSuccess: (data) => { toast.success(`Alert ${data.enabled ? "enabled" : "disabled"}.`); invalidateAll(); },
      onError: (err) => toast.error(err.message),
    })
  );

  function getAlert(type: AlertType) {
    return alerts?.find((a) => a.alertType === type);
  }

  function getTemplates(type: AlertType): string[] {
    if (templates[type] !== undefined) return templates[type]!;
    const alert = getAlert(type);
    return (alert?.messageTemplates as string[]) ?? [];
  }

  function handleExpand(type: AlertType) {
    if (expanded === type) { setExpanded(null); return; }
    setExpanded(type);
    const alert = getAlert(type);
    if (alert) {
      setTemplates((t) => ({ ...t, [type]: (alert.messageTemplates as string[]) ?? [] }));
      setMinThreshold((m) => ({ ...m, [type]: alert.minThreshold }));
      setCooldown((c) => ({ ...c, [type]: alert.cooldownSeconds }));
    }
  }

  function saveAlert(type: AlertType) {
    upsertMutation.mutate({
      alertType: type,
      messageTemplates: getTemplates(type).filter((t) => t.trim()),
      minThreshold: minThreshold[type] ?? 1,
      cooldownSeconds: cooldown[type] ?? 0,
    });
  }

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="Chat Alerts" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">Enable the bot for your channel first to manage alerts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Chat Alerts" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Chat Alerts" platforms={["twitch"]} />

      <div className="glass-subtle mb-4 flex items-center gap-2 rounded-lg px-3 py-2">
        <Bell className="size-4 shrink-0 text-brand-main" />
        <p className="text-xs text-muted-foreground">
          Configure chat messages for 17 Twitch EventSub events. Requires EventSub setup.
          Use variables like <code className="font-mono">{"{username}"}</code>, <code className="font-mono">{"{viewerCount}"}</code>, <code className="font-mono">{"{bits}"}</code>, <code className="font-mono">{"{months}"}</code>.
        </p>
      </div>

      <div className="space-y-2">
        {ALERT_TYPES.map(({ type, label, icon }) => {
          const alert = getAlert(type);
          const isExpanded = expanded === type;
          const kwTemplates = getTemplates(type);

          return (
            <Card key={type} className={alert?.enabled ? "border-brand-main/20" : ""}>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    {alert?.enabled && kwTemplates.length > 0 && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{kwTemplates[0]}</p>
                    )}
                  </div>
                  <Switch
                    checked={alert?.enabled ?? false}
                    onCheckedChange={() => { if (canManage) toggleMutation.mutate({ alertType: type }); }}
                    disabled={!canManage || toggleMutation.isPending}
                  />
                  <Button variant="ghost" size="icon-xs" onClick={() => handleExpand(type)}>
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground">Message Templates (one is picked randomly)</label>
                        <Button size="xs" variant="outline" onClick={() => setTemplates((t) => ({ ...t, [type]: [...(t[type] ?? []), ""] }))}>
                          <Plus className="size-3 mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {kwTemplates.map((tmpl, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Input
                              className="h-7 text-xs"
                              placeholder={`Template ${i + 1}`}
                              value={tmpl}
                              onChange={(e) => {
                                const updated = [...kwTemplates];
                                updated[i] = e.target.value;
                                setTemplates((t) => ({ ...t, [type]: updated }));
                              }}
                            />
                            <Button variant="ghost" size="icon-xs" onClick={() => setTemplates((t) => ({ ...t, [type]: kwTemplates.filter((_, j) => j !== i) }))}>
                              <X className="size-3" />
                            </Button>
                          </div>
                        ))}
                        {kwTemplates.length === 0 && (
                          <p className="text-xs text-muted-foreground">No templates — a default message will be used.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Threshold (bits/viewers)</label>
                        <Input
                          type="number" min={1} max={100000}
                          value={minThreshold[type] ?? alert?.minThreshold ?? 1}
                          onChange={(e) => setMinThreshold((m) => ({ ...m, [type]: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Cooldown (seconds)</label>
                        <Input
                          type="number" min={0} max={86400}
                          value={cooldown[type] ?? alert?.cooldownSeconds ?? 0}
                          onChange={(e) => setCooldown((c) => ({ ...c, [type]: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    {canManage && (
                      <Button size="sm" onClick={() => saveAlert(type)} disabled={upsertMutation.isPending}>
                        Save Alert
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
