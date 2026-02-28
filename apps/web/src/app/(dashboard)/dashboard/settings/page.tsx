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
} from "lucide-react";
import Image from "next/image";
import { getRoleDisplay, canManageCommands } from "@/utils/roles";

const PROVIDER_ICONS: Record<string, { label: string; className: string }> = {
  twitch: { label: "Twitch", className: "text-brand-twitch" },
  discord: { label: "Discord", className: "text-brand-discord" },
};

type Tab = "account" | "data";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Settings</h1>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "account"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Account
        </button>
        <button
          onClick={() => setActiveTab("data")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "data"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Data
        </button>
      </div>

      {activeTab === "account" ? <AccountTab /> : <DataTab canImport={canManage} />}
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
    <div className="space-y-6">
      {/* Profile card */}
      <Card>
        <CardContent className="flex items-center gap-4">
          {profile.image ? (
            <Image
              src={profile.image}
              alt={profile.name}
              width={64}
              height={64}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-overlay">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {profile.name}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.className}`}
              >
                {roleInfo.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs text-muted-foreground/70">
              Member since{" "}
              {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <Card>
        <CardContent>
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Connected Accounts
          </h3>
          {profile.connectedAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connected accounts.
            </p>
          ) : (
            <div className="space-y-3">
              {profile.connectedAccounts.map((account) => {
                const providerInfo = PROVIDER_ICONS[account.provider] ?? {
                  label: account.provider,
                  className: "text-foreground",
                };
                return (
                  <div
                    key={account.provider}
                    className="flex items-center gap-3 rounded-lg bg-surface-raised p-3"
                  >
                    <span
                      className={`text-sm font-semibold ${providerInfo.className}`}
                    >
                      {providerInfo.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ID: {account.accountId}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
    <div className="space-y-6">
      {/* Export */}
      <Card>
        <CardContent>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Export Data
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Download all your data including profile, commands, and settings as a
            JSON file.
          </p>
          <Button onClick={handleExport} disabled={isExporting} size="sm">
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
          <CardContent>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Import from StreamElements
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
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
