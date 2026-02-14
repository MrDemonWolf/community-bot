import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import AuthCtaButton from "@/components/auth-cta-button";
import { Github, Twitter, Twitch, Youtube, Globe } from "lucide-react";

const singleChannelMode =
  process.env.NEXT_PUBLIC_SINGLE_CHANNEL_MODE === "true";
const channelUrl = process.env.NEXT_PUBLIC_CHANNEL_URL;
const channelName = process.env.NEXT_PUBLIC_CHANNEL_NAME ?? "My Channel";
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

const features = [
  {
    title: "Chat Commands",
    description:
      "Custom commands with variables, cooldowns, and access levels. Built to make chat management effortless.",
  },
  {
    title: "Stream Notifications",
    description:
      "Automatic Discord notifications when you go live on Twitch. Keep your community in the loop.",
  },
  {
    title: "Viewer Queue",
    description:
      "Let viewers join a queue right from chat. Perfect for game nights and community events.",
  },
];

export default function Home() {
  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Hero */}
      <section className="bg-white px-6 pb-24 pt-16 dark:bg-[#091533]">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              {singleChannelMode
                ? `The bot powering ${channelName}'s community.`
                : "The ultimate community bot for Twitch and Discord."}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-500 dark:text-white/60">
              {singleChannelMode
                ? "Custom chat commands, stream notifications, viewer queue, and more — all managed from a single dashboard."
                : "Powerful moderation and community tools that connect you with your audience. Chat commands, stream notifications, and viewer engagement — all in one place."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {singleChannelMode && channelUrl && (
                <Link href={channelUrl as Route}>
                  <Button
                    size="lg"
                    className="bg-[#9146FF] px-6 text-white hover:bg-[#7B2FF0]"
                  >
                    Visit {channelName}
                  </Button>
                </Link>
              )}
              <AuthCtaButton />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 px-6 py-24 dark:bg-[#0a1a3a]">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Everything you need to{" "}
            <span className="text-[#00ACED]">run your community</span>.
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-gray-500 dark:text-white/50">
            {singleChannelMode
              ? `Here's what powers ${channelName}'s stream.`
              : "Built for streamers and their communities, from chat moderation to live notifications."}
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0d1f42]"
              >
                <h3 className="mb-2 font-semibold text-[#00ACED]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-white/50">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-white px-6 py-24 dark:bg-[#091533]">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            {singleChannelMode ? (
              <>
                Join{" "}
                <span className="text-[#00ACED]">{channelName}</span>
                {"'s community!"}
              </>
            ) : (
              <>
                Start using{" "}
                <span className="text-[#00ACED]">Community Bot</span> today!
              </>
            )}
          </h2>
          <p className="mb-8 text-gray-500 dark:text-white/50">
            {singleChannelMode
              ? "Check out the stream and join the fun."
              : "Set up your bot in minutes. Focus on your stream, we'll handle the rest."}
          </p>
          <div className="flex justify-center gap-3">
            {singleChannelMode && channelUrl && (
              <Link href={channelUrl as Route}>
                <Button
                  size="lg"
                  className="bg-[#9146FF] px-6 text-white hover:bg-[#7B2FF0]"
                >
                  Visit {channelName}
                </Button>
              </Link>
            )}
            <Link href="/login">
              <Button
                size="lg"
                className="bg-[#00ACED] px-6 text-white hover:bg-[#0090c4]"
              >
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8 dark:border-white/5 dark:bg-[#091533]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">
              <span className="text-[#00ACED]">Community</span> Bot
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
                    className="text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
          <div className="flex w-full flex-col items-center gap-3 border-t border-gray-200 pt-5 dark:border-white/5">
            <span className="text-sm text-gray-400 dark:text-white/40">
              &copy; {new Date().getFullYear()}{" "}
              {copyrightUrl ? (
                <a
                  href={copyrightUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 dark:hover:text-white/70"
                >
                  {copyrightName || "Community Bot"}
                </a>
              ) : (
                (copyrightName || "Community Bot")
              )}
            </span>
            <div className="flex gap-6 text-sm text-gray-400 dark:text-white/40">
              {privacyUrl && (
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 dark:hover:text-white/70"
                >
                  Privacy Policy
                </a>
              )}
              {termsUrl && (
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 dark:hover:text-white/70"
                >
                  Terms of Service
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
