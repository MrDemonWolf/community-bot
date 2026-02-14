"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "cookie-consent-accepted";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL;
  const termsUrl = process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL;

  // Don't show if no legal URLs are configured
  if (!privacyUrl && !termsUrl) return null;

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-sm text-muted-foreground sm:text-left">
          By using this site, you agree to our{" "}
          {privacyUrl && (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-cyan underline-offset-2 hover:underline"
            >
              Privacy Policy
            </a>
          )}
          {privacyUrl && termsUrl && " and "}
          {termsUrl && (
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-cyan underline-offset-2 hover:underline"
            >
              Terms of Service
            </a>
          )}
          .
        </p>
        <Button
          variant="outline"
          className="shrink-0 border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10"
          onClick={handleAccept}
        >
          Accept
        </Button>
      </div>
    </div>
  );
}
