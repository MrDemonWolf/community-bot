"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertCircle, Loader2, Save, ShieldAlert, Info } from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { useState } from "react";

export default function AutoModPage() {
  const queryClient = useQueryClient();
  const settingsQueryKey = trpc.automod.get.queryOptions().queryKey;

  const { data: botStatus } = useQuery(trpc.botChannel.getStatus.queryOptions());
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  const { data: settings, isLoading } = useQuery(trpc.automod.get.queryOptions());

  const [automodEnabled, setAutomodEnabled] = useState<boolean | null>(null);
  const [automodAction, setAutomodAction] = useState<string | null>(null);
  const [suspiciousUserEnabled, setSuspiciousUserEnabled] = useState<boolean | null>(null);
  const [suspiciousUserAction, setSuspiciousUserAction] = useState<string | null>(null);

  const updateMutation = useMutation(
    trpc.automod.update.mutationOptions({
      onSuccess: () => {
        toast.success("AutoMod settings saved.");
        queryClient.invalidateQueries({ queryKey: settingsQueryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleSave() {
    updateMutation.mutate({
      automodEnabled: automodEnabled ?? settings?.automodEnabled,
      automodAction: (automodAction ?? settings?.automodAction) as any,
      suspiciousUserEnabled: suspiciousUserEnabled ?? settings?.suspiciousUserEnabled,
      suspiciousUserAction: (suspiciousUserAction ?? settings?.suspiciousUserAction) as any,
    });
  }

  const current = {
    automodEnabled: automodEnabled ?? settings?.automodEnabled ?? false,
    automodAction: automodAction ?? settings?.automodAction ?? "notify",
    suspiciousUserEnabled: suspiciousUserEnabled ?? settings?.suspiciousUserEnabled ?? false,
    suspiciousUserAction: suspiciousUserAction ?? settings?.suspiciousUserAction ?? "notify",
  };

  if (!botStatus?.botChannel?.enabled) {
    return (
      <div>
        <PageHeader title="AutoMod" platforms={["twitch"]} />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">Enable the bot for your channel first to manage AutoMod settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="AutoMod" platforms={["twitch"]} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="AutoMod" platforms={["twitch"]} />

      <div className="glass-subtle mb-4 flex items-center gap-2 rounded-lg px-3 py-2">
        <Info className="size-4 shrink-0 text-brand-main" />
        <p className="text-xs text-muted-foreground">
          AutoMod and Suspicious User integration requires EventSub setup and the{" "}
          <code className="font-mono">moderator:manage:automod</code> OAuth scope.
        </p>
      </div>

      <div className="space-y-4">
        {/* AutoMod Held Messages */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-brand-main" />
              <CardTitle className="text-base">AutoMod Held Messages</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable AutoMod Integration</p>
                <p className="text-xs text-muted-foreground">Receive notifications when AutoMod holds a message.</p>
              </div>
              <Switch
                checked={current.automodEnabled}
                onCheckedChange={(v) => setAutomodEnabled(v)}
                disabled={!canManage}
              />
            </label>

            {current.automodEnabled && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Action for held messages</label>
                <select
                  className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={current.automodAction}
                  onChange={(e) => setAutomodAction(e.target.value)}
                  disabled={!canManage}
                >
                  <option value="notify">Notify only (log to audit)</option>
                  <option value="auto_approve">Auto-approve held messages</option>
                  <option value="auto_deny">Auto-deny held messages</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suspicious Users */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500" />
              <CardTitle className="text-base">Suspicious Users</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Suspicious User Monitoring</p>
                <p className="text-xs text-muted-foreground">Take action when Twitch flags a user as suspicious.</p>
              </div>
              <Switch
                checked={current.suspiciousUserEnabled}
                onCheckedChange={(v) => setSuspiciousUserEnabled(v)}
                disabled={!canManage}
              />
            </label>

            {current.suspiciousUserEnabled && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Action for suspicious users</label>
                <select
                  className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={current.suspiciousUserAction}
                  onChange={(e) => setSuspiciousUserAction(e.target.value)}
                  disabled={!canManage}
                >
                  <option value="notify">Notify only (log to audit)</option>
                  <option value="restrict">Restrict user (monitor-only mode)</option>
                  <option value="ban">Ban user automatically</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {canManage && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? <Loader2 className="size-4 animate-spin mr-2" />
                : <Save className="size-4 mr-2" />}
              Save AutoMod Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
