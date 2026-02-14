import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import AuthCtaButton from "@/components/auth-cta-button";

const singleChannelMode =
  process.env.NEXT_PUBLIC_SINGLE_CHANNEL_MODE === "true";
const channelUrl = process.env.NEXT_PUBLIC_CHANNEL_URL;
const channelName = process.env.NEXT_PUBLIC_CHANNEL_NAME ?? "My Channel";

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
      <section className="bg-background px-6 pb-24 pt-16">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <h1 className="animate-fade-in-up text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              {singleChannelMode
                ? `The bot powering ${channelName}'s community.`
                : "The ultimate community bot for Twitch and Discord."}
            </h1>
            <p className="animate-fade-in-up mt-4 text-lg leading-relaxed text-muted-foreground" style={{ animationDelay: "100ms" }}>
              {singleChannelMode
                ? "Custom chat commands, stream notifications, viewer queue, and more — all managed from a single dashboard."
                : "Powerful moderation and community tools that connect you with your audience. Chat commands, stream notifications, and viewer engagement — all in one place."}
            </p>
            <div className="animate-fade-in-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "200ms" }}>
              {singleChannelMode && channelUrl && (
                <Link href={channelUrl as Route}>
                  <Button
                    size="lg"
                    className="bg-brand-twitch px-6 text-white hover:bg-brand-twitch/80"
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
      <section className="bg-muted px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-2xl font-bold text-foreground sm:text-3xl">
            Everything you need to{" "}
            <span className="text-brand-cyan">run your community</span>.
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
            {singleChannelMode
              ? `Here's what powers ${channelName}'s stream.`
              : "Built for streamers and their communities, from chat moderation to live notifications."}
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="animate-fade-in-up rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <h3 className="mb-2 font-semibold text-brand-cyan">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-background px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
            {singleChannelMode ? (
              <>
                Join{" "}
                <span className="text-brand-cyan">{channelName}</span>
                {"'s community!"}
              </>
            ) : (
              <>
                Start using{" "}
                <span className="text-brand-cyan">Community Bot</span> today!
              </>
            )}
          </h2>
          <p className="mb-8 text-muted-foreground">
            {singleChannelMode
              ? "Check out the stream and join the fun."
              : "Set up your bot in minutes. Focus on your stream, we'll handle the rest."}
          </p>
          <div className="flex justify-center gap-3">
            {singleChannelMode && channelUrl && (
              <Link href={channelUrl as Route}>
                <Button
                  size="lg"
                  className="bg-brand-twitch px-6 text-white hover:bg-brand-twitch/80"
                >
                  Visit {channelName}
                </Button>
              </Link>
            )}
            <Link href="/login">
              <Button
                size="lg"
                className="bg-brand-cyan px-6 text-white hover:bg-brand-cyan/80 hover:shadow-[0_0_20px_oklch(0.72_0.15_220_/_30%)]"
              >
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
