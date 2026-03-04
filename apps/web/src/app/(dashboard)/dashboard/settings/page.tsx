"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Loader2,
  User,
  Sparkles,
  LinkIcon,
} from "lucide-react";
import Image from "next/image";
import { getRoleDisplay, canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";

const PROVIDER_INFO: Record<
  string,
  {
    label: string;
    className: string;
    bgClassName: string;
    borderClassName: string;
  }
> = {
  twitch: {
    label: "Twitch",
    className: "text-brand-twitch",
    bgClassName: "bg-brand-twitch/10",
    borderClassName: "border-l-brand-twitch",
  },
  discord: {
    label: "Discord",
    className: "text-brand-discord",
    bgClassName: "bg-brand-discord/10",
    borderClassName: "border-l-brand-discord",
  },
};

type Tab = "account" | "features" | "data";

const TABS: { value: Tab; label: string }[] = [
  { value: "account", label: "Account" },
  { value: "features", label: "Features" },
  { value: "data", label: "Data" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  return (
    <div>
      <PageHeader title="Settings" />

      {/* Pill-style tab bar */}
      <div className="mb-6 flex gap-1 rounded-full bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "account" ? (
        <AccountTab />
      ) : activeTab === "features" ? (
        <FeaturesTab canManage={canManage} />
      ) : (
        <DataTab canImport={canManage} />
      )}
    </div>
  );
}

function AccountTab() {
  const { data: profile, isLoading } = useQuery(
    trpc.user.getProfile.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return null;

  const roleInfo = getRoleDisplay(profile.role, profile.isChannelOwner);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile card */}
      <Card>
        <CardContent className="flex items-center gap-5 py-6">
          {profile.image ? (
            <Image
              src={profile.image}
              alt={profile.name}
              width={64}
              height={64}
              className="size-16 rounded-full ring-2 ring-border"
              unoptimized
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-surface-overlay ring-2 ring-border">
              <User className="size-8 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-lg font-bold text-foreground">
                {profile.name}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleInfo.className}`}
              >
                {roleInfo.label}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Member since{" "}
              {new Date(profile.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Connected Accounts
          </h3>
        </div>
        {profile.connectedAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No connected accounts.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.connectedAccounts.map((account) => {
              const info = PROVIDER_INFO[account.provider] ?? {
                label: account.provider,
                className: "text-foreground",
                bgClassName: "bg-muted",
                borderClassName: "border-l-border",
              };
              return (
                <Card
                  key={account.provider}
                  className={`border-l-4 ${info.borderClassName}`}
                >
                  <CardContent className="flex items-center gap-3 py-4">
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${info.bgClassName}`}
                    >
                      <span
                        className={`text-sm font-bold ${info.className}`}
                      >
                        {info.label.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold ${info.className}`}
                      >
                        {info.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        ID: {account.accountId}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
                      Connected
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturesTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data: botStatus, isLoading } = useQuery(
    trpc.botChannel.getStatus.queryOptions()
  );

  const toggleMutation = useMutation(
    trpc.botChannel.toggleAiShoutout.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `AI shoutouts ${data.aiShoutoutEnabled ? "enabled" : "disabled"}.`
        );
        queryClient.invalidateQueries({
          queryKey: trpc.botChannel.getStatus.queryOptions().queryKey,
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const aiEnabled = botStatus?.botChannel?.aiShoutoutEnabled ?? false;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* AI-Enhanced Shoutouts */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-main/10">
                <Sparkles className="size-5 text-brand-main" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  AI-Enhanced Shoutouts
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Generate personalized shoutout messages using AI when using
                  !so. Requires GEMINI_API_KEY to be configured.
                </p>
              </div>
            </div>
            {canManage && botStatus?.botChannel?.enabled && (
              <Switch
                checked={aiEnabled}
                disabled={toggleMutation.isPending}
                onCheckedChange={(v) =>
                  toggleMutation.mutate({ enabled: v })
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataTab({ canImport }: { canImport: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const importMutation = useMutation(
    trpc.user.importStreamElements.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Imported ${data.imported} commands, skipped ${data.skipped}.`
        );
        queryClient.invalidateQueries({
          queryKey: trpc.chatCommand.list.queryOptions().queryKey,
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await queryClient.fetchQuery(
        trpc.user.exportData.queryOptions()
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `community-bot-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully.");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // StreamElements export format: array of commands or { commands: [...] }
      const commands = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.commands)
          ? parsed.commands
          : null;

      if (!commands) {
        toast.error(
          "Invalid StreamElements export format. Expected an array of commands."
        );
        return;
      }

      importMutation.mutate({ commands });
    } catch {
      toast.error("Failed to parse JSON file.");
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Export */}
      <Card>
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold text-foreground">
            Export Data
          </h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Download all your data including profile, commands, and settings as a
            JSON file.
          </p>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            size="sm"
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export Data
          </Button>
        </CardContent>
      </Card>

      {/* StreamElements Import */}
      {canImport && (
        <Card>
          <CardContent className="py-5">
            <h3 className="text-sm font-semibold text-foreground">
              Import from StreamElements
            </h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Import commands from a StreamElements JSON export. Commands that
              already exist will be skipped. Timers and spam filter import will be
              available when those features are added.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="se-import"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                size="sm"
                variant="outline"
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Choose File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
