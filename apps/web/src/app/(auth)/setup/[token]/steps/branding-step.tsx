"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface BrandingStepProps {
  /** Called when the user saves or skips this step. */
  onComplete: () => void;
}

/**
 * Setup wizard step for configuring branding settings.
 *
 * Saves company name, copyright info, and social links to the
 * SystemConfig table via tRPC. All fields are optional — the user
 * can skip to use env-var defaults.
 */
export default function BrandingStep({ onComplete }: BrandingStepProps) {
  const [brandName, setBrandName] = useState("");
  const [copyrightName, setCopyrightName] = useState("");
  const [copyrightUrl, setCopyrightUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [saved, setSaved] = useState(false);

  // Pre-fill from any previously saved branding
  const { data: existing } = useQuery({
    ...trpc.setup.getBranding.queryOptions(),
    refetchOnWindowFocus: false,
  });

  // Populate fields once existing data loads
  useEffect(() => {
    if (existing) {
      if (existing.brandName) setBrandName(existing.brandName);
      if (existing.copyrightName) setCopyrightName(existing.copyrightName);
      if (existing.copyrightUrl) setCopyrightUrl(existing.copyrightUrl);
      if (existing.socialLinks) setSocialLinks(existing.socialLinks);
    }
  }, [existing]);

  const saveMutation = useMutation(
    trpc.setup.saveBranding.mutationOptions({
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => onComplete(), 1200);
      },
    })
  );

  const handleSave = () => {
    saveMutation.mutate({
      brandName: brandName || undefined,
      copyrightName: copyrightName || undefined,
      copyrightUrl: copyrightUrl || undefined,
      socialLinks: socialLinks || undefined,
    });
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          Branding saved!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-name">Company / Brand Name</Label>
          <Input
            id="brand-name"
            placeholder="Community Bot"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="copyright-name">Copyright Name</Label>
          <Input
            id="copyright-name"
            placeholder="MrDemonWolf, Inc."
            value={copyrightName}
            onChange={(e) => setCopyrightName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="copyright-url">Copyright URL</Label>
          <Input
            id="copyright-url"
            type="url"
            placeholder="https://example.com"
            value={copyrightUrl}
            onChange={(e) => setCopyrightUrl(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="social-links">Social Links</Label>
          <Input
            id="social-links"
            placeholder="https://twitter.com/you, https://github.com/you"
            value={socialLinks}
            onChange={(e) => setSocialLinks(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated URLs. Icons auto-detected from hostname.
          </p>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full rounded-md bg-brand-main py-6 text-sm font-bold text-white hover:bg-brand-main/80"
        onClick={handleSave}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save & Continue"
        )}
      </Button>

      {saveMutation.isError && (
        <p className="text-center text-sm text-red-500">
          {saveMutation.error.message}
        </p>
      )}

      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={onComplete}
      >
        Skip — use defaults
      </button>
    </div>
  );
}

export { BrandingStep };
export type { BrandingStepProps };
