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
  return (
    <footer className="border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm font-bold tracking-tight text-foreground">
            <span className="text-brand-cyan">Community</span> Bot
          </span>
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
        </div>
        <div className="flex w-full flex-col items-center gap-3 border-t border-border pt-5">
          <span className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()}{" "}
            {copyrightUrl ? (
              <a
                href={copyrightUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                {copyrightName || "Community Bot"}
              </a>
            ) : (
              (copyrightName || "Community Bot")
            )}
          </span>
          <div className="flex gap-6 text-sm text-muted-foreground">
            {privacyUrl && (
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Privacy Policy
              </a>
            )}
            {termsUrl && (
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Terms of Service
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
