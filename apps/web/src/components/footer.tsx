import { Github, Twitter, Twitch, Youtube, Globe } from "lucide-react";

const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL;
const termsUrl = process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL;
const copyrightName = process.env.NEXT_PUBLIC_COPYRIGHT_NAME;
const copyrightUrl = process.env.NEXT_PUBLIC_COPYRIGHT_URL;
const socialLinks = process.env.NEXT_PUBLIC_SOCIAL_LINKS
  ? process.env.NEXT_PUBLIC_SOCIAL_LINKS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

function getSocialIcon(url: string) {
  const hostname = new URL(url).hostname.replace("www.", "");
  if (hostname.includes("twitter.com") || hostname.includes("x.com"))
    return Twitter;
  if (hostname.includes("github.com")) return Github;
  if (hostname.includes("twitch.tv")) return Twitch;
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return Youtube;
  return Globe;
}

function getSocialLabel(url: string) {
  const hostname = new URL(url).hostname.replace("www.", "");
  if (hostname.includes("twitter.com") || hostname.includes("x.com"))
    return "Twitter";
  if (hostname.includes("github.com")) return "GitHub";
  if (hostname.includes("twitch.tv")) return "Twitch";
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return "YouTube";
  return hostname;
}

export default function Footer() {
  const privacyHref = privacyUrl || "/privacy";
  const termsHref = termsUrl || "/terms";
  const isPrivacyExternal = !!privacyUrl;
  const isTermsExternal = !!termsUrl;

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Branding */}
          <span className="font-heading text-lg font-bold tracking-tight">
            <span className="text-brand-main">Community</span>{" "}
            <span className="text-foreground">Bot</span>
          </span>

          {/* Social Icons */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-4">
              {socialLinks.map((url) => {
                const Icon = getSocialIcon(url);
                const label = getSocialLabel(url);
                return (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-border" />

        {/* Bottom row: copyright + legal links */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()}{" "}
            {copyrightUrl ? (
              <a
                href={copyrightUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {copyrightName || "Community Bot"}
              </a>
            ) : (
              (copyrightName || "Community Bot")
            )}
          </p>

          {/* Legal Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href={privacyHref}
              {...(isPrivacyExternal
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="transition-colors hover:text-foreground"
            >
              Privacy Policy
            </a>
            <a
              href={termsHref}
              {...(isTermsExternal
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="transition-colors hover:text-foreground"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
