"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Loader2,
  Sparkles,
  FileJson,
  Database,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { canManageCommands } from "@/utils/roles";
import { PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";

type Tab = "general" | "import-export" | "data";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canManage = canManageCommands(profile?.role ?? "USER");

  return (
    <div>
      <PageHeader title="Settings" />

      <Tabs>
        <TabsList>
          <TabsTrigger
            active={activeTab === "general"}
            onClick={() => setActiveTab("general")}
          >
            <Settings className="mr-1.5 size-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === "import-export"}
            onClick={() => setActiveTab("import-export")}
          >
            <FileJson className="mr-1.5 size-3.5" />
            Import / Export
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
          >
            <Database className="mr-1.5 size-3.5" />
            Data
          </TabsTrigger>
        </TabsList>

        {activeTab === "general" && (
          <TabsContent>
            <GeneralTab canManage={canManage} />
          </TabsContent>
        )}
        {activeTab === "import-export" && (
          <TabsContent>
            <ImportExportTab canImport={canManage} />
          </TabsContent>
        )}
        {activeTab === "data" && (
          <TabsContent>
            <DataTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  General Tab                                                       */
/* ------------------------------------------------------------------ */

function GeneralTab({ canManage }: { canManage: boolean }) {
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
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-main/10">
              <Sparkles className="size-4 text-brand-main" />
            </div>
            AI-Enhanced Shoutouts
          </CardTitle>
          <CardDescription>
            Generate personalized shoutout messages using AI when using !so.
            Requires GEMINI_API_KEY to be configured on the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {aiEnabled ? "Enabled" : "Disabled"}
            </span>
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

/* ------------------------------------------------------------------ */
/*  Import / Export Tab                                                */
/* ------------------------------------------------------------------ */

function ImportExportTab({ canImport }: { canImport: boolean }) {
  const queryClient = useQueryClient();
  const nightbotFileRef = useRef<HTMLInputElement>(null);
  const communityFileRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportCommands, setExportCommands] = useState(true);
  const [exportTimers, setExportTimers] = useState(true);
  const [exportCounters, setExportCounters] = useState(true);
  const [exportQuotes, setExportQuotes] = useState(true);

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

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      const data = await queryClient.fetchQuery(
        trpc.user.exportData.queryOptions()
      );

      // Filter based on checkboxes
      const filtered: Record<string, unknown> = {};
      if (exportCommands && "commands" in (data as object))
        filtered.commands = (data as Record<string, unknown>).commands;
      if (exportTimers && "timers" in (data as object))
        filtered.timers = (data as Record<string, unknown>).timers;
      if (exportCounters && "counters" in (data as object))
        filtered.counters = (data as Record<string, unknown>).counters;
      if (exportQuotes && "quotes" in (data as object))
        filtered.quotes = (data as Record<string, unknown>).quotes;

      // If nothing selected or data doesn't have those keys, export all
      const exportPayload =
        Object.keys(filtered).length > 0 ? filtered : data;

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
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

  const handleFileImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    ref: React.RefObject<HTMLInputElement | null>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const commands = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.commands)
          ? parsed.commands
          : null;

      if (!commands) {
        toast.error(
          "Invalid import format. Expected an array of commands or { commands: [...] }."
        );
        return;
      }

      importMutation.mutate({ commands });
    } catch {
      toast.error("Failed to parse JSON file.");
    } finally {
      if (ref.current) {
        ref.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-brand-main" />
            Export Data
          </CardTitle>
          <CardDescription>
            Select what to include in the export and download as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Commands", checked: exportCommands, set: setExportCommands },
              { label: "Timers", checked: exportTimers, set: setExportTimers },
              { label: "Counters", checked: exportCounters, set: setExportCounters },
              { label: "Quotes", checked: exportQuotes, set: setExportQuotes },
            ].map((item) => (
              <label
                key={item.label}
                className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.set(e.target.checked)}
                  className="size-4 rounded border-border accent-brand-main"
                />
                {item.label}
              </label>
            ))}
          </div>
          <Button
            onClick={handleExportJson}
            disabled={isExporting}
            size="sm"
          >
            {isExporting ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-3.5" />
            )}
            Export JSON
          </Button>
        </CardContent>
      </Card>

      {/* Import from Nightbot */}
      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-4 text-brand-main" />
              Import from Nightbot
            </CardTitle>
            <CardDescription>
              Upload a Nightbot JSON export file. Commands that already exist can
              be skipped or overwritten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={nightbotFileRef}
              type="file"
              accept=".json"
              onChange={(e) => handleFileImport(e, nightbotFileRef)}
              className="hidden"
              id="nightbot-import"
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={() => nightbotFileRef.current?.click()}
                disabled={importMutation.isPending}
                size="sm"
                variant="outline"
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 size-3.5" />
                )}
                Choose File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Community Bot JSON */}
      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-4 text-brand-main" />
              Import Community Bot JSON
            </CardTitle>
            <CardDescription>
              Re-import a previously exported Community Bot JSON file to restore
              commands, timers, and other data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={communityFileRef}
              type="file"
              accept=".json"
              onChange={(e) => handleFileImport(e, communityFileRef)}
              className="hidden"
              id="community-import"
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={() => communityFileRef.current?.click()}
                disabled={importMutation.isPending}
                size="sm"
                variant="outline"
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 size-3.5" />
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

/* ------------------------------------------------------------------ */
/*  Data Tab                                                          */
/* ------------------------------------------------------------------ */

function DataTab() {
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const handleExportMyData = async () => {
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
      a.download = `my-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Your data has been exported.");
    } catch {
      toast.error("Failed to export your data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Export My Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-muted-foreground" />
            Export My Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your personal data stored in Community Bot,
            including your profile, settings, and activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportMyData}
            disabled={isExporting}
            size="sm"
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-3.5" />
            )}
            Export My Data
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-destructive/80">
            Warning: This will permanently remove your profile, connected
            accounts, and all activity history. You will not be able to recover
            your data after deletion.
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              toast.error(
                "Account deletion is not yet implemented. Contact an administrator."
              )
            }
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
