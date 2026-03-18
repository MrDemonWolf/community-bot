"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, Info, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function TitleGeneratorPage() {
  const [brandingPrompt, setBrandingPrompt] = useState("");
  const [context, setContext] = useState("");
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentGame, setCurrentGame] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const settings = trpc.titleGenerator.getSettings.useQuery();
  const updateSettings = trpc.titleGenerator.updateSettings.useMutation({
    onSuccess: () => toast.success("Branding prompt saved."),
    onError: (err) => toast.error(err.message),
  });
  const generate = trpc.titleGenerator.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedTitles(data.titles);
      setCurrentTitle(data.currentTitle);
      setCurrentGame(data.currentGame);
      setCooldown(30);
    },
    onError: (err) => toast.error(err.message),
  });
  const setTitle = trpc.titleGenerator.setTitle.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Stream title updated!");
      setCurrentTitle(variables.title);
    },
    onError: (err) => toast.error(err.message),
  });

  // Load saved branding prompt
  useEffect(() => {
    if (settings.data) {
      setBrandingPrompt(settings.data.brandingPrompt);
    }
  }, [settings.data]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function handleSaveSettings() {
    updateSettings.mutate({ brandingPrompt });
  }

  function handleGenerate() {
    generate.mutate({ context: context || undefined });
  }

  function handleSetTitle(title: string) {
    setTitle.mutate({ title });
  }

  return (
    <div>
      <PageHeader title="Title Generator" platforms={["twitch"]} />

      <div className="glass-subtle mb-4 flex items-center gap-2 rounded-lg px-3 py-2">
        <Info className="size-4 shrink-0 text-brand-main" />
        <p className="text-xs text-muted-foreground">
          Generate AI-powered stream titles based on your brand. Powered by
          Google Gemini.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Column — Config & Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Brand Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Describe your stream's brand, personality, and vibe..."
                value={brandingPrompt}
                onChange={(e) => setBrandingPrompt(e.target.value)}
                rows={4}
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {brandingPrompt.length}/1000
                </span>
                <Button
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={updateSettings.isPending}
                >
                  {updateSettings.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stream Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="What are you streaming today? Any special events?"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {context.length}/500
                </span>
              </div>
              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={generate.isPending || cooldown > 0}
              >
                {generate.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {cooldown > 0
                  ? `Generate (${cooldown}s)`
                  : "Generate Titles"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Generated Titles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentTitle && (
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Current Title
                </p>
                <p className="text-sm">{currentTitle}</p>
                {currentGame && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Game: {currentGame}
                  </p>
                )}
              </div>
            )}

            {generatedTitles.length === 0 && !generate.isPending && (
              <p className="text-sm text-muted-foreground">
                Click Generate to get AI-powered title suggestions.
              </p>
            )}

            {generate.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Generating
                titles...
              </div>
            )}

            {generatedTitles.map((title, i) => (
              <div
                key={i}
                className="rounded-md border border-border p-3 transition-colors hover:border-brand-main/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm">{title}</p>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {title.length}/140
                  </span>
                </div>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetTitle(title)}
                    disabled={setTitle.isPending}
                  >
                    {setTitle.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Check className="size-3" />
                    )}
                    Use This
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
