import Link from "next/link";
import { Button } from "@/components/ui/button";

const singleChannelMode =
  process.env.NEXT_PUBLIC_SINGLE_CHANNEL_MODE === "true";
const channelUrl = process.env.NEXT_PUBLIC_CHANNEL_URL;
const channelName = process.env.NEXT_PUBLIC_CHANNEL_NAME ?? "My Channel";
const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL;
const termsUrl = process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL;

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
      <section className="bg-[#091533] px-6 pb-24 pt-16">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              {singleChannelMode
                ? `The bot powering ${channelName}'s community.`
                : "The ultimate community bot for Twitch and Discord."}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/60">
              {singleChannelMode
                ? "Custom chat commands, stream notifications, viewer queue, and more — all managed from a single dashboard."
                : "Powerful moderation and community tools that connect you with your audience. Chat commands, stream notifications, and viewer engagement — all in one place."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {singleChannelMode && channelUrl && (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    className="bg-[#9146FF] px-6 text-white hover:bg-[#7B2FF0]"
                  >
                    Visit {channelName}
                  </Button>
                </a>
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
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#0a1a3a] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-2xl font-bold text-white sm:text-3xl">
            Everything you need to{" "}
            <span className="text-[#00ACED]">run your community</span>.
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-white/50">
            {singleChannelMode
              ? `Here's what powers ${channelName}'s stream.`
              : "Built for streamers and their communities, from chat moderation to live notifications."}
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-white/10 bg-[#0d1f42] p-6"
              >
                <h3 className="mb-2 font-semibold text-[#00ACED]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-white/50">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#091533] px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
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
          <p className="mb-8 text-white/50">
            {singleChannelMode
              ? "Check out the stream and join the fun."
              : "Set up your bot in minutes. Focus on your stream, we'll handle the rest."}
          </p>
          <div className="flex justify-center gap-3">
            {singleChannelMode && channelUrl && (
              <a href={channelUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="bg-[#9146FF] px-6 text-white hover:bg-[#7B2FF0]"
                >
                  Visit {channelName}
                </Button>
              </a>
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
      <footer className="border-t border-white/5 bg-[#091533] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm font-bold tracking-tight text-white">
            <span className="text-[#00ACED]">Community</span> Bot
          </span>
          <div className="flex gap-6 text-sm text-white/40">
            {privacyUrl && (
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white/70"
              >
                Privacy Policy
              </a>
            )}
            {termsUrl && (
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white/70"
              >
                Terms of Service
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
