"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, FlaskConical, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const ACCESS_LEVELS = ["EVERYONE", "SUBSCRIBER", "REGULAR", "VIP", "MODERATOR", "LEAD_MODERATOR", "BROADCASTER"] as const;

type AccessLevel = (typeof ACCESS_LEVELS)[number];

interface TestInput {
  message: string;
  username: string;
  accessLevel: AccessLevel;
  isLive: boolean;
}

const defaultInput: TestInput = {
  message: "",
  username: "testuser",
  accessLevel: "EVERYONE",
  isLive: true,
};

export default function ConfigTesterPage() {
  const [input, setInput] = useState<TestInput>(defaultInput);
  const [enabled, setEnabled] = useState(false);

  const { data: result, isLoading, refetch } = useQuery({
    ...trpc.configTester.test.queryOptions({
      message: input.message,
      username: input.username,
      accessLevel: input.accessLevel,
      isLive: input.isLive,
      dryRun: true,
    }),
    enabled: enabled && !!input.message.trim(),
  });

  function handleTest() {
    if (!input.message.trim()) { toast.error("Enter a message to test."); return; }
    setEnabled(true);
    refetch();
  }

  return (
    <div>
      <PageHeader title="Config Tester" platforms={["twitch"]} />

      <div className="glass-subtle mb-4 flex items-center gap-2 rounded-lg px-3 py-2">
        <Info className="size-4 shrink-0 text-brand-main" />
        <p className="text-xs text-muted-foreground">
          Simulate how the bot would handle a message — without sending anything to chat.
          Checks spam filters, keywords, and commands in pipeline order.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Input Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Test Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Message</label>
              <Input
                placeholder="e.g. !commands or hello world"
                value={input.message}
                onChange={(e) => setInput({ ...input, message: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") handleTest(); }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Username</label>
              <Input
                placeholder="testuser"
                value={input.username}
                onChange={(e) => setInput({ ...input, username: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Access Level</label>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={input.accessLevel}
                onChange={(e) => setInput({ ...input, accessLevel: e.target.value as AccessLevel })}
              >
                {ACCESS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={input.isLive} onCheckedChange={(v) => setInput({ ...input, isLive: v })} />
              Stream is live
            </label>
            <Button className="w-full" onClick={handleTest} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              Run Test
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!result && !isLoading && (
              <p className="text-sm text-muted-foreground">Run a test to see results here.</p>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Evaluating...
              </div>
            )}
            {result && (
              <div className="space-y-3">
                {/* Spam Check */}
                <div className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {result.spamCheck.triggered
                      ? <XCircle className="size-4 text-red-400" />
                      : <CheckCircle2 className="size-4 text-green-400" />}
                    <span className="text-sm font-medium">Spam Filter</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.spamCheck.triggered
                      ? `Triggered: ${result.spamCheck.type}${result.spamCheck.value ? ` (${result.spamCheck.value})` : ""}`
                      : "Passed — no spam detected"}
                  </p>
                </div>

                {/* Keyword */}
                <div className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {result.matchedKeyword
                      ? <CheckCircle2 className="size-4 text-brand-main" />
                      : <AlertTriangle className="size-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">Keyword Match</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.matchedKeyword
                      ? `Matched: "${result.matchedKeyword.name}"${result.matchedKeyword.stopProcessing ? " (stops processing)" : ""}`
                      : "No keyword matched"}
                  </p>
                </div>

                {/* Built-in Command */}
                <div className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {result.matchedBuiltIn
                      ? <CheckCircle2 className="size-4 text-brand-main" />
                      : <AlertTriangle className="size-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">Built-in Command</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.matchedBuiltIn ? `Matched: !${result.matchedBuiltIn}` : "No built-in command matched"}
                  </p>
                </div>

                {/* DB Command */}
                <div className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {result.matchedDbCommand
                      ? <CheckCircle2 className="size-4 text-brand-main" />
                      : <AlertTriangle className="size-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">Custom Command</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.matchedDbCommand ? `Matched: "${result.matchedDbCommand.name}"` : "No custom command matched"}
                  </p>
                </div>

                {/* Response Preview */}
                {result.responsePreview && (
                  <div className="rounded-md border border-brand-main/30 bg-brand-main/5 p-3">
                    <p className="mb-1 text-xs font-medium text-brand-main">Response Preview</p>
                    <p className="text-sm text-foreground">{result.responsePreview}</p>
                  </div>
                )}

                {!result.matchedKeyword && !result.matchedBuiltIn && !result.matchedDbCommand && !result.spamCheck.triggered && (
                  <p className="text-xs text-muted-foreground">No handler matched — message passes through silently.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
