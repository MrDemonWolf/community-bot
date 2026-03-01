"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

export function JsonImportExport({
  json,
  onApply,
}: {
  json: string;
  onApply: (json: string) => void;
}) {
  const [draft, setDraft] = useState(json);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Keep draft in sync when external json changes
  // We do this on toggle open via the details element instead
  function handleToggle(e: React.ToggleEvent<HTMLDetailsElement>) {
    if (e.newState === "open") {
      setDraft(json);
      setError("");
    }
  }

  function handleApply() {
    if (!draft.trim()) {
      onApply("");
      setError("");
      return;
    }
    try {
      JSON.parse(draft);
      onApply(draft);
      setError("");
      toast.success("JSON applied");
    } catch {
      setError("Invalid JSON");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    toast.success("Copied JSON to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <details className="group" onToggle={handleToggle}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        JSON Import / Export
      </summary>
      <div className="mt-2 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          rows={6}
          className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-1"
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="xs" onClick={handleCopy}>
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            Copy
          </Button>
          <Button size="xs" onClick={handleApply}>
            Apply JSON
          </Button>
        </div>
      </div>
    </details>
  );
}
